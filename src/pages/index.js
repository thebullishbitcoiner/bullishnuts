import useProofStorage from "@/hooks/useProofStorage";
import { CashuMint, CashuWallet, getEncodedToken } from "@cashu/cashu-ts";
import React, { useState, useEffect } from "react";

const Wallet = () => {
  const [formData, setFormData] = useState({
    mintUrl: "",
    meltInvoice: "",
    swapAmount: "",
  });
  const [dataOutput, setDataOutput] = useState(null);

  /**
   * @type {[CashuWallet|null, React.Dispatch<React.SetStateAction<CashuWallet|null>>]}
   */
  const [wallet, setWallet] = useState(null);

  const { addProofs, balance, removeProofs, getProofsByAmount } =
    useProofStorage();

  useEffect(() => {
    const storedMintData = JSON.parse(localStorage.getItem("mint"));
    if (storedMintData) {
      const { url, keyset } = storedMintData;
      const mint = new CashuMint(url);

      // initialize wallet with store keyset so we don't have to fetch them again
      const wallet = new CashuWallet(mint, { keys: keyset, unit: "sat" });
      setWallet(wallet);

      setFormData((prevData) => ({ ...prevData, mintUrl: url }));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSetMint = async () => {
    const mint = new CashuMint(formData.mintUrl);

    try {
      const info = await mint.getInfo();
      setDataOutput(info);

      const { keysets } = await mint.getKeys();

      const satKeyset = keysets.find((k) => k.unit === "sat");
      setWallet(new CashuWallet(mint, { keys: satKeyset }));

      localStorage.setItem(
        "mint",
        JSON.stringify({ url: formData.mintUrl, keyset: satKeyset })
      );
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to connect to mint", details: error });
    }
  };

  async function handleReceive_Lightning(amount) {
    const quote = await wallet.getMintQuote(amount);

    setDataOutput(quote);

    //Close the receive Lightning modal just before showing the invoice modal
    closeReceiveLightningModal();
    showInvoiceModal(quote.request);

    const intervalId = setInterval(async () => {
      try {
        const { proofs } = await wallet.mintTokens(amount, quote.quote, {
          keysetId: wallet.keys.id,
        });
        setDataOutput({ "minted proofs": proofs });
        addProofs(proofs);

        closeInvoiceModal();
        alert('Invoice paid!');

        clearInterval(intervalId);
      } catch (error) {
        console.error("Quote probably not paid: ", quote.request, error);
        setDataOutput({ timestamp: new Date().toLocaleTimeString(), error: "Failed to mint", details: error });
      }
    }, 5000);
  }

  async function handleReceive_Ecash(token) {
    try {
      const { token: newToken, tokensWithErrors } = await wallet.receive(token);
      const { proofs } = newToken.token[0];
      addProofs(proofs);

      closeReceiveEcashModal();
      alert('Ecash received!');

      setDataOutput(proofs);
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to claim swap tokens", details: error });
    }
  }

  async function handleSend_Ecash(amount) {
    const proofs = getProofsByAmount(amount);

    if (proofs.length === 0) {
      alert("Insufficient balance");
      return;
    }

    try {
      const { send, returnChange } = await wallet.send(amount, proofs);

      const encodedToken = getEncodedToken({
        token: [{ proofs: send, mint: wallet.mint.mintUrl }],
      });

      //Close the sats input modal and display the cashu token modal
      closeSendEcashModal();
      showCashuTokeneModal(encodedToken);

      removeProofs(proofs);
      addProofs(returnChange);
      setDataOutput(encodedToken);
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to swap tokens", details: error });
    }
  }

  async function handleSend_Lightning() {
    try {
      const input = document.getElementById('send_lightning_input').value;
      const isInvoice = input.startsWith("lnbc1");
      var invoice = "";
      if (isInvoice) {
        invoice = input;

        const quote = await wallet.getMeltQuote(invoice);

        setDataOutput([{ "got melt quote": quote }]);

        const amount = quote.amount + quote.fee_reserve;
        const proofs = getProofsByAmount(amount, wallet.keys.id);
        if (proofs.length === 0) {
          alert("Insufficient balance");
          return;
        }
        const { isPaid, change } = await wallet.meltTokens(quote, proofs, {
          keysetId: wallet.keys.id,
        });
        if (isPaid) {
          closeSendLightningModal();
          alert('Invoice paid!');
          removeProofs(proofs);
          addProofs(change);
        }
      }
      else { //It must be a Lightning address (but we will check)
        closeSendLightningModal();
        handleSend_LightningAddress_GetCallback(input);
      }
    }
    catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to melt tokens", details: error });
    }
  }

  //This function checks to see if the Lightning address provided is valid, gets the amount of sats to send, and fetches invoice using the callback URL
  async function handleSend_LightningAddress_GetCallback(input) {
    try {
      const lightningAddressParts = input.split('@');
      const username = lightningAddressParts[0];
      const domain = lightningAddressParts[1];
      const url = `https://${domain}/.well-known/lnurlp/${username}`;
      const response = await fetch(url);

      // Check if the request was successful
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
        return;
      }

      const data = await response.json();
      const callback = data.callback;

      //Wait to get amount of sats from user
      const sats = await showSendLightningAddressModal();
      const millisats = sats * 1000;

      //Wait to get invoice using callback URL
      const invoice = await fetchInvoiceFromCallback(callback, millisats);

      //Wait to get melt quote from mint
      const quote = await wallet.getMeltQuote(invoice);

      setDataOutput([{ "got melt quote": quote }]);

      const amount = quote.amount + quote.fee_reserve;
      const proofs = getProofsByAmount(amount, wallet.keys.id);
      if (proofs.length === 0) {
        alert("Insufficient balance");
        return;
      }
      const { isPaid, change } = await wallet.meltTokens(quote, proofs, {
        keysetId: wallet.keys.id,
      });
      if (isPaid) {
        alert(quote.amount + ' sat(s) sent to ' + input);
        removeProofs(proofs);
        addProofs(change);
      }
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to melt tokens", details: error });
    }
  }

  async function handleSend_LightningAddress_GetInvoice() {
    try {
      const sendAmount = document.getElementById('send_lightning_amount').value;
      const invoice = fetchInvoiceFromCallback(callback, sendAmount);

      const quote = await wallet.getMeltQuote(invoice);

      setDataOutput([{ "got melt quote": quote }]);

      const amount = quote.amount + quote.fee_reserve;
      const proofs = getProofsByAmount(amount, wallet.keys.id);
      if (proofs.length === 0) {
        alert("Insufficient balance");
        return;
      }
      const { isPaid, change } = await wallet.meltTokens(quote, proofs, {
        keysetId: wallet.keys.id,
      });
      if (isPaid) {
        closeSendLightningAddressModal();
        alert('Invoice paid!');
        removeProofs(proofs);
        addProofs(change);
      }
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to melt tokens", details: error });
    }
  }

  async function fetchInvoiceFromCallback(callbackURL, amount) {
    const url = new URL(callbackURL);
    const params = {
      amount: amount,
    };
    url.search = new URLSearchParams(params).toString();

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.pr;
    } catch (error) {
      console.error('Error fetching JSON:', error);
    }
  }

  const handleCopyP2NPUB = async (event) => {
    try {
      const value = event.target.value;
      await navigator.clipboard.writeText(value);
      alert('P2NPUB address copied to clipboard: ' + value);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  function refreshPage() {
    window.location.reload();
  }

  function showInvoiceModal(invoice) {
    const modal = document.getElementById('invoiceModal');
    const invoiceText = document.getElementById('invoiceText');
    invoiceText.value = invoice;
    modal.style.display = 'block';
  }

  function closeInvoiceModal() {
    const modal = document.getElementById('invoiceModal');
    document.getElementById('invoiceText').value = '';
    modal.style.display = 'none';
  }

  const copyToClipboard = async () => {
    try {
      const invoiceText = document.getElementById('invoiceText');
      await navigator.clipboard.writeText(invoiceText.value);

      // Change button text to "Copied" temporarily
      const copyButton = document.getElementById('copyButton');
      copyButton.textContent = 'Copied';

      // Reset button text after 1000ms (1 second)
      setTimeout(() => {
        copyButton.textContent = 'Copy';
      }, 1000);

    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  async function copyCashuToken() {
    try {
      const token = document.getElementById('send_cashu_token').value;
      await navigator.clipboard.writeText(token);

      // Change button text to "Copied" temporarily
      const copyButton = document.getElementById('copy_token_button');
      copyButton.textContent = 'Copied';

      // Reset button text after 1000ms (1 second)
      setTimeout(() => {
        copyButton.textContent = 'Copy';
      }, 1000);

    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  }

  //Send modals

  function showSendEcashModal() {
    const modal = document.getElementById('send_ecash_modal');
    modal.style.display = 'block';
  }

  function sendEcashButtonClicked() {
    const amount = parseInt(document.getElementById('ecash_amount').value);
    if (!isNaN(amount) && amount > 0) {
      handleSend_Ecash(amount);
    } else {
      alert('Please enter a valid amount of sats');
    }
  }

  function showCashuTokeneModal(token) {
    const modal = document.getElementById('cashu_token_modal');
    document.getElementById('send_cashu_token').value = token;
    modal.style.display = 'block';
  }

  function closeCashuTokenModal() {
    document.getElementById('send_cashu_token').value = '';
    const modal = document.getElementById('cashu_token_modal');
    modal.style.display = 'none';
  }

  function closeSendEcashModal() {
    const modal = document.getElementById('send_ecash_modal');
    document.getElementById('ecash_amount').value = '';
    modal.style.display = 'none';
  }

  function showSendLightningModal() {
    const modal = document.getElementById('send_lightning_modal');
    modal.style.display = 'block';
  }

  function closeSendLightningModal() {
    const modal = document.getElementById('send_lightning_modal');
    document.getElementById('send_lightning_input').value = '';
    modal.style.display = 'none';
  }

  // function showSendLightningAddressModal() {
  //   const modal = document.getElementById('send_lightning_address_modal');
  //   modal.style.display = 'block';
  // }

  function showSendLightningAddressModal() {
    return new Promise((resolve) => {
      const modal = document.getElementById('send_lightning_address_modal');
      const input = document.getElementById('send_lightning_amount');
      const submitButton = document.getElementById('send_lightning_submit');

      modal.style.display = 'block';

      submitButton.onclick = () => {
        const value = input.value;
        modal.style.display = 'none';
        resolve(value);
      };
    });
  }

  function closeSendLightningAddressModal() {
    const modal = document.getElementById('send_lightning_address_modal');
    document.getElementById('send_lightning_amount').value = '';
    modal.style.display = 'none';
  }

  //Receive modals

  function showReceiveLightningModal() {
    const modal = document.getElementById('receive_lightning_modal');
    modal.style.display = 'block';
  }

  function closeReceiveLightningModal() {
    const modal = document.getElementById('receive_lightning_modal');
    document.getElementById('satsAmount').value = '';
    modal.style.display = 'none';
  }

  function createInvoiceButtonClicked() {
    const amount = parseInt(document.getElementById('satsAmount').value);
    if (!isNaN(amount) && amount > 0) {
      handleReceive_Lightning(amount);
    } else {
      alert('Please enter a valid amount of sats');
    }
  }

  function claimButtonClicked() {
    const cashuToken = document.getElementById('cashu_token').value;
    if (cashuToken !== null) {
      handleReceive_Ecash(cashuToken);
    } else {
      alert('Please paste a cashu token');
    }
  }

  function showReceiveEcashModal() {
    const modal = document.getElementById('receive_ecash_modal');
    modal.style.display = 'block';
  }

  function closeReceiveEcashModal() {
    const modal = document.getElementById('receive_ecash_modal');
    document.getElementById('cashu_token').value = '';
    modal.style.display = 'none';
  }

  return (
    <main>

      <div className="cashu-operations-container">

        <div id="refresh-icon" onClick={refreshPage}>↻</div>

        {/* Invoice modal */}
        <div id="invoiceModal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeInvoiceModal}>&times;</span>
            <p>Invoice:</p>
            <textarea id="invoiceText" readOnly></textarea>
            <button id="copyButton" className="styled-button" onClick={copyToClipboard}>Copy</button>
          </div>
        </div>

        <h6>bullishNuts <small>v0.0.44</small></h6>
        <br></br>

        <div className="section">
          <h2>Balance</h2>
          <p>{balance} sats</p>
        </div>

        <div className="section">
          <h2>Mint</h2>
          <label htmlFor="mint-url"><a href="https://bitcoinmints.com/">View list of available mints</a></label>
          <input
            type="text"
            name="mintUrl"
            className="mint-url"
            value={formData.mintUrl}
            onChange={handleChange}
          />
          <button className="mint-connect-button" onClick={handleSetMint}>
            Set Mint
          </button>
        </div>

        <div className="section">
          <h2>Send</h2>
          <button className="styled-button" onClick={showSendEcashModal}>Ecash</button>
          <button className="styled-button" onClick={showSendLightningModal}>Lightning</button>
        </div>

        {/* Send ecash modal */}
        <div id="send_ecash_modal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeSendEcashModal}>&times;</span>
            <label>Enter amount of sats:</label>
            <input type="number" id="ecash_amount" name="ecash_amount" min="1" />
            <button className="styled-button" onClick={sendEcashButtonClicked}>Send</button>
          </div>
        </div>

        {/* Cashu token modal */}
        <div id="cashu_token_modal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeCashuTokenModal}>&times;</span>
            <p>Cashu token:</p>
            <textarea id="send_cashu_token" readOnly></textarea>
            <button id="copy_token_button" className="styled-button" onClick={copyCashuToken}>Copy</button>
          </div>
        </div>

        {/* Send lightning modal */}
        <div id="send_lightning_modal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeSendLightningModal}>&times;</span>
            <label>Paste LNURL or Lightning address:</label>
            <textarea id="send_lightning_input"></textarea>
            <button className="styled-button" onClick={handleSend_Lightning}>Enter</button>
          </div>
        </div>

        {/* Send Lightning address modal */}
        <div id="send_lightning_address_modal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeSendLightningAddressModal}>&times;</span>
            <label>Enter amount of sats:</label>
            <input type="number" id="send_lightning_amount" min="1" />
            <button className="styled-button" id="send_lightning_submit">Send</button>
          </div>
        </div>

        <div className="section">
          <h2>Receive</h2>
          <button className="styled-button" onClick={showReceiveEcashModal}>Ecash</button>
          <button className="styled-button" onClick={showReceiveLightningModal}>Lightning</button>
        </div>

        {/* Receive ecash modal */}
        <div id="receive_ecash_modal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeReceiveEcashModal}>&times;</span>
            <label>Paste Cashu token:</label>
            <textarea id="cashu_token"></textarea>
            <button className="styled-button" onClick={claimButtonClicked}>Claim</button>
          </div>
        </div>

        {/* Receive Lightning modal */}
        <div id="receive_lightning_modal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeReceiveLightningModal}>&times;</span>
            <label>Enter amount of sats:</label>
            <input type="number" id="satsAmount" min="1" />
            <button className="styled-button" onClick={createInvoiceButtonClicked}>Create invoice</button>
          </div>
        </div>

        <div className="data-display-container">
          <h2>Data Output</h2>
          <pre id="data-output" className="data-output">{JSON.stringify(dataOutput, null, 2)}</pre>
        </div>

        <br></br>

        <div className="section">
          <h2>Zap Deez Nuts</h2>
          {/* <button className="styled-button" onClick={handleCopyP2NPUB}
          value="npub15ypxpg429uyjmp0zczuza902chuvvr4pn35wfzv8rx6cej4z8clq6jmpcx@openbalance.app">OpenBalance</button> */}
          <button className="styled-button" onClick={handleCopyP2NPUB}
            value="npub15ypxpg429uyjmp0zczuza902chuvvr4pn35wfzv8rx6cej4z8clq6jmpcx@npub.cash">npub.cash</button>
        </div>

        <div className="section">
          <small>Made with 🐂 by <a href="https://thebullishbitcoiner.com/">thebullishbitcoiner</a></small>
        </div>


      </div>

    </main>
  );

};

export default Wallet;
