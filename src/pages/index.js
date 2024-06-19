import useProofStorage from "@/hooks/useProofStorage";
import { CashuMint, CashuWallet, getEncodedToken } from "@cashu/cashu-ts";
import React, { useState, useEffect } from "react";

const Wallet = () => {
  const [formData, setFormData] = useState({
    mintUrl: "",
    mintAmount: "",
    bolt11_invoice: "",
    meltInvoice: "",
    swapAmount: "",
    swapToken: "",
  });
  const [dataOutput, setDataOutput] = useState(null);
  const [stateLog, setStateLog] = useState([]);

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

  const handleMint = async () => {
    const amount = parseInt(formData.mintAmount);
    const quote = await wallet.getMintQuote(amount);

    setDataOutput(quote);
    setFormData((prevData) => ({ ...prevData, bolt11_invoice: quote.request }));
    setStateLog((prevLog) => [...prevLog, { timestamp: new Date().toISOString(), quote}]);

    //Display the invoice in the text area
    var textArea = document.getElementById('bolt11_invoice');
    textArea.value = quote.request;

    await navigator.clipboard.writeText(quote.request);
    alert('Invoice copied to clipboard!');

    const intervalId = setInterval(async () => {
      try {
        const { proofs } = await wallet.mintTokens(amount, quote.quote, {
          keysetId: wallet.keys.id,
        });
        setDataOutput({ "minted proofs": proofs });
        setFormData((prevData) => ({ ...prevData, mintAmount: "", bolt11_invoice: "" }));
        addProofs(proofs);
        clearInterval(intervalId);
      } catch (error) {
        console.error("Quote probably not paid: ", quote.request, error);
        setDataOutput({ error: "Failed to mint", details: error });
        setStateLog((prevLog) => [...prevLog, { timestamp: new Date().toISOString(), details: error}]);
      }
    }, 5000);
  };

  const handleMelt = async () => {
    try {
      const quote = await wallet.getMeltQuote(formData.meltInvoice);
      
      setDataOutput([{ "got melt quote": quote }]);
      setStateLog((prevLog) => [...prevLog, { timestamp: new Date().toISOString(), quote}]);

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

  const handleCopy = async () => {
    var textArea = document.getElementById('bolt11_invoice');
    try {
      await navigator.clipboard.writeText(textArea.value);
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <main>

      <div className="cashu-operations-container">

        <h6>bullishNuts <small>v0.0.23</small></h6>
        <br></br>
        <div className="section">
          <h2>Balance</h2>
          <p>{balance} sats</p>
        </div>

        <div className="section">
          <h2>Mint</h2>
          <label htmlFor="mint-url"><a href="https://bitcoinmints.com/">[View list of available mints]</a></label>
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
          <h2>Minting Tokens</h2>
          <label htmlFor="mint-amount">Amount:</label>
          <input
            type="number"
            name="mintAmount"
            className="mint-amount"
            value={formData.mintAmount}
            onChange={handleChange}
          />
          <button className="mint-button" onClick={handleMint}>Mint</button>
          <label htmlFor="mint-amount">Invoice:</label>
          <textarea
            readOnly
            id="bolt11_invoice"
            name="bolt11_invoice"
            value={formData.bolt11_invoice}
            onChange={handleChange}
          ></textarea>
          <button id="copyButton" onClick={handleCopy}>Copy</button>
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
          <h2>Logs</h2>
          <pre className="data-output">
            {stateLog.map((logEntry, index) => (
              <div key={index}>
                {JSON.stringify(logEntry)}
              </div>
            ))}
          </pre>
        </div>

      </div>

    </main>
  );

};

export default Wallet;
