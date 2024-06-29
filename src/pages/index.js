import useProofStorage from "@/hooks/useProofStorage";
import { CashuMint, CashuWallet, getEncodedToken } from "@cashu/cashu-ts";
import React, { useState, useEffect } from "react";

const Wallet = () => {
  const [formData, setFormData] = useState({
    mintUrl: "",
    meltInvoice: "",
    swapAmount: "",
    swapToken: "",
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

  async function handleMint(amount) {
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

  const handleMelt = async () => {
    try {
      const quote = await wallet.getMeltQuote(formData.meltInvoice);

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
        removeProofs(proofs);
        addProofs(change);
      }
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to melt tokens", details: error });
    }
  };

  const handleSwapSend = async () => {
    const swapAmount = parseInt(formData.swapAmount);
    const proofs = getProofsByAmount(swapAmount);

    if (proofs.length === 0) {
      alert("Insufficient balance");
      return;
    }

    try {
      const { send, returnChange } = await wallet.send(swapAmount, proofs);

      const encodedToken = getEncodedToken({
        token: [{ proofs: send, mint: wallet.mint.mintUrl }],
      });

      removeProofs(proofs);
      addProofs(returnChange);
      setDataOutput(encodedToken);
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to swap tokens", details: error });
    }
  };

  const handleSwapClaim = async () => {
    const token = formData.swapToken;

    try {
      const { token: newToken, tokensWithErrors } = await wallet.receive(token);

      const { proofs } = newToken.token[0];

      addProofs(proofs);
      setDataOutput(proofs);
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to claim swap tokens", details: error });
    }
  };

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

  function showReceiveLightningModal() {
    const modal = document.getElementById('receive_lightning_modal');
    modal.style.display = 'block';
  }

  function closeReceiveLightningModal() {
    const modal = document.getElementById('receive_lightning_modal');
    modal.style.display = 'none';
  }

  function createInvoiceButtonClicked() {
    const amount = parseInt(document.getElementById('satsAmount').value);
    if (!isNaN(amount) && amount > 0) {
      handleMint(amount);
    } else {
      alert('Please enter a valid amount of sats');
    }
  }

  return (
    <main>

      <div className="cashu-operations-container">

        <div id="refresh-icon" onClick={refreshPage}>↻</div>

        {/* Invoice modal  */}
        <div id="invoiceModal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeInvoiceModal}>&times;</span>
            <p>Invoice:</p>
            <textarea id="invoiceText" readOnly></textarea>
            <button id="copyButton" className="styled-button" onClick={copyToClipboard}>Copy</button>
          </div>
        </div>

        <h6>bullishNuts <small>v0.0.41</small></h6>
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
          <h2>Receive</h2>
          <button className="styled-button">Ecash</button>
          <button className="styled-button" onClick={showReceiveLightningModal}>Lightning</button>
        </div>

        {/* Receive Lightning modal  */}
        <div id="receive_lightning_modal" class="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeReceiveLightningModal}>&times;</span>
            <label>Enter amount of sats:</label>
            <input type="number" id="satsAmount" name="satsAmount" min="1" />
            <button className="styled-button" onClick={createInvoiceButtonClicked}>Create invoice</button>
          </div>
        </div>

        <div className="section">
          <h2>Melt Tokens</h2>
          <label htmlFor="melt-invoice">Bolt11 Invoice:</label>
          <input
            type="text"
            name="meltInvoice"
            className="melt-invoice"
            value={formData.meltInvoice}
            onChange={handleChange}
          />
          <button className="melt-button" onClick={handleMelt}>
            Melt
          </button>
        </div>

        <div className="section">
          <h2>Swap Tokens</h2>
          <label htmlFor="swap-amount">Amount:</label>
          <input
            type="number"
            name="swapAmount"
            className="swap-amount"
            value={formData.swapAmount}
            onChange={handleChange}
          />
          <button className="swap-send-button" onClick={handleSwapSend}>
            Swap to Send
          </button>
          <label htmlFor="swap-token">Token:</label>
          <input
            type="text"
            name="swapToken"
            className="swap-token"
            value={formData.swapToken}
            onChange={handleChange}
          />
          <button className="swap-claim-button" onClick={handleSwapClaim}>
            Swap to Claim
          </button>
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
