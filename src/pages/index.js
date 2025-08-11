import useMultiMintStorage from "@/hooks/useMultiMintStorage";
import { encodeEmoji, decodeEmoji } from "@/hooks/EmojiEncoder";
import { CashuMint, CashuWallet, getEncodedToken, getDecodedToken, getEncodedTokenV4, CheckStateEnum, MeltQuoteState, getKeepAmounts, MintQuoteState } from "@cashu/cashu-ts";
import React, { useState, useEffect, useRef } from "react";
import packageJson from "../../package.json";

// Custom components
import TypewriterModal from '@/components/TypewriterModal';
import Contacts from "@/components/Contacts";
import LightningModal from '@/components/LightningModal';
import Mints from "@/components/Mints";
import EcashOrLightning from "@/components/EcashOrLightning";
import Transactions from "@/components/Transactions";
import QRCodeScanner from '@/components/QRCodeScanner';
import NutSplits from '@/components/NutSplits';
import AutoSweepModal from '@/components/AutoSweepModal';

import QRCode from 'qrcode';
import JSConfetti from 'js-confetti';

//Nostr
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import crypto from 'crypto'
import * as secp from '@noble/secp256k1'
import { Relay } from 'nostr-tools/relay'
import { SimplePool } from 'nostr-tools/pool'
import { encode, decode } from 'bech32-buffer';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

//Lightning
import { LightningAddress } from "@getalby/lightning-tools";

// Icons
import { RefreshIcon, SendIcon, ReceiveIcon, LightningIcon, CheckIcon, ExportIcon, QrCodeIcon } from "@bitcoin-design/bitcoin-icons-react/filled";

// Product data
const products = [
  {
    id: 1,
    name: "bullishNuts Hat",
    price: 21000,
    thumbnail: "/images/bullishNuts_logo-192x192.png",
    description: "Comfortable cotton hat with the bullishNuts logo"
  },
  {
    id: 2,
    name: "bullishNuts Hoodie",
    price: 15000, // 15000 sats
    thumbnail: "/images/bullishNuts_logo-192x192.png",
    description: "Warm hoodie perfect for cold weather"
  },
  {
    id: 3,
    name: "bullishNuts Sticker Pack",
    price: 1000, // 1000 sats
    thumbnail: "/images/bullishNuts_logo-192x192.png",
    description: "Set of 5 high-quality vinyl stickers"
  },
  {
    id: 4,
    name: "bullishNuts Mug",
    price: 3000, // 3000 sats
    thumbnail: "/images/bullishNuts_logo-192x192.png",
    description: "Ceramic mug with the bullishNuts logo"
  }
];

const Wallet = () => {
  const [isBalanceHidden, setIsBalanceHidden] = useState(true);

  // For LightningModal component
  const [isLightningModalOpen, setIsLightningModalOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [lightningModalInitValue, setLightningModalInitValue] = useState("");

  const [isEcashOrLightningOpen, setIsEcashOrLightningOpen] = useState(false);
  const [ecashOrLightningModalLabel, setEcashOrLightningModalLabel] = useState("");
  const [updateFlag_Transactions, setUpdateFlag_Transactions] = useState(0);

  // For QRCodeScanner component
  const [isScanQRModalOpen, setIsScanQRModalOpen] = useState(false);
  const [scannedData, setScannedData] = useState('');

  // For NutSplits component
  const [isNutSplitsModalOpen, setIsNutSplitsModalOpen] = useState(false);

  const [typewriterMessages, setTypewriterMessages] = useState([]);
  const [isTypewriterModalOpen, setIsTypewriterModalOpen] = useState(false);

  const jsConfettiRef = useRef(null); // Create a ref to store the jsConfetti instance

  const [isAutoSweepModalOpen, setIsAutoSweepModalOpen] = useState(false);

  // For Merch Modal
  const [isMerchModalOpen, setIsMerchModalOpen] = useState(false);
  const [isMerchPaymentModalOpen, setIsMerchPaymentModalOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [merchTotal, setMerchTotal] = useState(0);

  useEffect(() => {
    jsConfettiRef.current = new JSConfetti(); // Initialize the instance
  }, []); // Runs only once when the component mounts

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedContacts = JSON.parse(localStorage.getItem('contacts')) || [];
      setContacts(storedContacts);
    }
  }, []);

  const updateContacts = (newContacts) => {
    setContacts(newContacts);
    if (typeof window !== 'undefined') {
      localStorage.setItem('contacts', JSON.stringify(newContacts));
    }
  };

  /**
   * @type {[CashuWallet|null, React.Dispatch<React.SetStateAction<CashuWallet|null>>]}
   */
  const [wallet, setWallet] = useState(null);

  const {
    addProofs,
    removeProofs,
    getProofsByAmount,
    getAllProofs,
    getMintBalance,
    balance,
  } =
    useMultiMintStorage();

  useEffect(() => {
    const storedMintData = JSON.parse(localStorage.getItem("activeMint"));
    if (storedMintData) {
      const { url, keyset } = storedMintData;
      const mint = new CashuMint(url);

      // initialize wallet with store keyset so we don't have to fetch them again
      const wallet = new CashuWallet(mint, { keys: keyset, unit: "sat" });
      setWallet(wallet);

      const savedState = localStorage.getItem('isBalanceHidden');
      if (savedState !== null) {
        setIsBalanceHidden(savedState === 'true');
      }
    }
    else {
      const introMessages = [
        "bullishNuts is an ecash wallet that's in its early beta phase with the goal of making your interactions with Cashu simple and fun!",
        "Since this is a progressive web app (PWA), you can easily add it to your device's home screen for quick access, just like a native app!",
        "Also, since it's a PWA, your ecash tokens are stored in your browser's local storage. Keep that in mind and sweep your sats out before deleting your browser data.",
        "Please use at your own risk with a small amount of sats at a time.",
        "Lastly, reach out on Nostr if you run into any issues. 🤙"
      ];
      showTypewriterModal(introMessages);
    }
  }, []);

  useEffect(() => {
    console.log(`Balance changed: ${balance}`);
    if (wallet) {
      checkAndPerformAutoSweep(wallet);
    }
  }, [balance]);

  // Cleanup effect to restore body overflow when component unmounts
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const handleMintChange = async (newMint) => {
    try {
      const mint = new CashuMint(newMint);
      const info = await mint.getInfo();

      const { keysets } = await mint.getKeys();
      const satKeyset = keysets.find((k) => k.unit === "sat");

      const newWallet = new CashuWallet(mint, { keys: satKeyset });
      setWallet(newWallet); // Still update state

      localStorage.setItem(
        "activeMint",
        JSON.stringify({ url: newMint, keyset: satKeyset })
      );

      console.log("Active mint changed to:", newMint);

      return newWallet; // Return the new wallet directly
    } catch (error) {
      console.error("Failed to handle mint change:", error);
      throw error; // Rethrow or handle the error as needed
    }
  };

  const handleQRScan = (data) => {
    setScannedData(data);
    setIsScanQRModalOpen(false); // Close the modal after scanning

    // Handle scanned data
    if (data.startsWith('cashu')) {  // Cashu token
      showReceiveEcashModal(data);
    } else if (data.toLowerCase().startsWith("lnbc")) { // Lightning invoice
      setLightningModalInitValue(data);
      setIsLightningModalOpen(true);
    } else if (data.toLowerCase().startsWith('lightning:')) {
      data = data.slice('lightning:'.length); // Remove the prefix
      if (isValidLightningAddress(data)) {
        setLightningModalInitValue(data);
        setIsLightningModalOpen(true);
      }
    } else if (data.startsWith("bitcoin:")) {  // BIP21 URI
      const lightningInvoice = data.match(/lightning=([^&]+)/);
      if (lightningInvoice) {
        setLightningModalInitValue(lightningInvoice[1].toLowerCase());  //The second element (index 1) is the captured group, which is the value of the lightning parameter
        setIsLightningModalOpen(true);
      }
    }
  };

  function isLightningInvoice(data) {
    // Check if the data is a string and starts with "ln"
    return typeof data === 'string' && data.startsWith('ln');
  }

  async function handleReceive_Lightning(amount) {
    if (wallet === null) {
      showToast("Mint needs to be set");
      return;
    }
    //const quote = await wallet.getMintQuote(amount);
    const quote = await wallet.createMintQuote(amount);

    storeJSON(quote);

    //Close the receive Lightning modal just before showing the invoice modal
    closeReceiveLightningModal();
    showInvoiceModal(quote.request);

    //==============
    // After some time of waiting, let's ask the mint if the request has been fullfilled.
    setTimeout(async () => await checkMintQuote(quote), 1000);

    const checkMintQuote = async (q) => {
      // with this call, we can check the current status of a given quote
      console.log('Checking the status of the quote: ' + q.quote);
      const quote = await wallet.checkMintQuote(q.quote);
      if (quote.error) {
        console.error(quote.error, quote.code, quote.detail);
        return;
      }
      if (quote.state === MintQuoteState.PAID) {
        //if the quote was paid, we can ask the mint to issue the signatures for the ecash
        const proofs = await wallet.mintProofs(amount, quote.quote);
        console.log(`minted proofs: ${proofs.map((p) => p.amount).join(', ')} sats`);

        //Add new proofs to existing ones
        addProofs(proofs, wallet.mint.mintUrl);
        closeInvoiceModal();
        const totalAmount = getTotalAmountFromProofs(proofs);
        addTransaction("Lightning", "Receive", wallet.mint.mintUrl, quote.request, totalAmount, "--");
        showToast(`${amount} sat${amount !== 1 ? 's' : ''} received`);
      } else if (quote.state === MintQuoteState.ISSUED) {
        // if the quote has already been issued, we will receive an error if we try to mint again
        console.error('Quote has already been issued');
        return;
      } else {
        // if the quote has not yet been paid, we will wait some more to get the status of the quote again
        setTimeout(async () => await checkMintQuote(q), 1000);
      }
    };
    //==============

    // const intervalId = setInterval(async () => {
    //   try {

    //     //const { proofs } = await wallet.mintTokens(amount, quote.quote, { keysetId: wallet.keys.id, });
    //     const { proofs } = await wallet.mintProofs(amount, quote.quote, { keysetId: wallet.keys.id, });

    //     //Add new proofs to local storage
    //     var proofsArray = { "proofs": proofs };
    //     storeJSON(proofsArray);

    //     //Add new proofs to existing ones
    //     addProofs(proofs, wallet.mint.mintUrl);
    //     closeInvoiceModal();
    //     const totalAmount = getTotalAmountFromProofs(proofs);
    //     addTransaction_Lightning("Receive", wallet.mint.mintUrl, quote.request, totalAmount, "--");
    //     showToast(`${amount} sat${amount !== 1 ? 's' : ''} received`);

    //     clearInterval(intervalId);
    //   } catch (error) {
    //     console.error("Quote probably not paid: ", quote.request, error);
    //   }
    // }, 5000);
  }

  async function handleReceive_Ecash(token) {
    try {
      const decodedToken = getDecodedToken(token);
      const mintURL = decodedToken.mint;

      // Declare a local variable to track the wallet
      let currentWallet = wallet;

      // If there's currently no active mint (i.e., wallet is null), get mint info and init the wallet
      if (wallet === null) {
        currentWallet = await handleMintChange(mintURL);  // Use the returned wallet from handleMintChange
      }

      // If the token being received is not associated with the current mint
      if (mintURL !== currentWallet.mint.mintUrl) {
        const mint = new CashuMint(mintURL);

        try {
          // Check if mint info is already in localStorage
          const storedMintInfo = JSON.parse(localStorage.getItem('mintInfo')) || {};

          // If the mint info for this URL is not in localStorage, fetch and store it
          if (!storedMintInfo[mintURL]) {
            const info = await mint.getInfo();

            // Store the fetched mint info in localStorage
            storedMintInfo[mintURL] = info;
            localStorage.setItem('mintInfo', JSON.stringify(storedMintInfo));
          }

          // Use the info from localStorage
          const mintInfo = storedMintInfo[mintURL];
          storeJSON(mintInfo);

          const { keysets } = await mint.getKeys();

          const satKeyset = keysets.find((k) => k.unit === "sat");
          const newWallet = new CashuWallet(mint, { keys: satKeyset, unit: "sat" });
          const proofs = await newWallet.receive(token);

          addProofs(proofs, mintURL);
          closeReceiveEcashModal();
          const totalAmount = getTotalAmountFromProofs(proofs);
          addTransaction("Ecash", "Receive", mintURL, null, totalAmount, null, token);
          showToast(`Received ${totalAmount} ${totalAmount === 1 ? 'sat' : 'sats'}!`);

          return;
        } catch (error) {
          console.error(error);
          storeJSON({ error: "Failed to receive ecash.", details: error });
        }
      }

      const proofs = await currentWallet.receive(token);
      addProofs(proofs, mintURL);
      closeReceiveEcashModal();
      const totalAmount = getTotalAmountFromProofs(proofs);
      addTransaction("Ecash", "Receive", mintURL, null, totalAmount, null, token);
      showToast(`Received ${totalAmount} ${totalAmount === 1 ? 'sat' : 'sats'}!`);
      storeJSON(proofs);
    } catch (error) {
      console.error(error);
      closeReceiveEcashModal();
      showToast(error);
    }
  }

  const getTotalAmountFromProofs = (proofs) => {
    return proofs.reduce((total, proof) => {
      return total + proof.amount;
    }, 0);
  };

  async function checkAndPerformAutoSweep(wallet) {
    const autoSweepSettings = JSON.parse(localStorage.getItem('autoSweep')) || {};
    const targetBalance = parseFloat(autoSweepSettings.targetBalance) || 0;
    const lightningAddress = autoSweepSettings.lightningAddress || '';

    // Check if auto sweep settings are defined
    if (!lightningAddress || isNaN(targetBalance) || targetBalance <= 0) {
      console.log("Auto sweep settings are not properly configured.");
      return; // Exit if settings are not valid
    }

    const mintBalance = getMintBalance(wallet.mint.mintUrl);
    const adjustedTargetBalance = targetBalance * 1.1;  //Add 10% cushion for fees

    if (mintBalance >= adjustedTargetBalance) {
      await performAutoSweep(wallet, mintBalance - adjustedTargetBalance, lightningAddress);
    }
  }

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function performAutoSweep(wallet, invoiceAmount, lightningAddress) {
    // Wait for 1 second (1000 milliseconds)
    await delay(1000);

    const ln = new LightningAddress(lightningAddress);
    await ln.fetch();
    const invoice = await ln.requestInvoice({ satoshi: invoiceAmount });
    const waitingModal = document.getElementById('waiting_modal');
    document.getElementById('waiting_message').textContent = `Performing auto sweep...`;
    waitingModal.style.display = 'block';

    const quote = await wallet.createMeltQuote(invoice.paymentRequest);
    storeJSON(quote);

    const amount = quote.amount + quote.fee_reserve;
    const proofs = getProofsByAmount(amount, wallet.mint.mintUrl, wallet.keys.id);
    if (proofs.length === 0) {
      waitingModal.style.display = 'none';
      showToast("Insufficient balance");
      return;
    }

    try {
      // Set a timeout of 10 seconds (10000 milliseconds) for to melt
      const payRes = await withTimeout(
        wallet.meltProofs(quote, proofs, { keysetId: wallet.keys.id }),
        10000
      );

      if (payRes.quote.paid) {
        waitingModal.style.display = 'none';
        showToast('Auto sweep successful!');
        removeProofs(proofs, wallet.mint.mintUrl);

        addTransaction("Lightning", "Auto Sweep", wallet.mint.mintUrl, invoice.paymentRequest, quote.amount, quote.fee_reserve);

        var changeArray = { "change": payRes.change };
        storeJSON(changeArray);
        addProofs(payRes.change, wallet.mint.mintUrl);
      }
    } catch (error) {
      // Handle error, whether it's a timeout or another issue
      waitingModal.style.display = 'none';
      console.error("Error occurred:", error.message);
      if (error.message === "Operation timed out") {
        showToast("Payment timed out.");
      } else {
        showToast(`Auto sweep failed: ${error.message}`);
      }
    }
  }

  async function createEcashToken(amount) {
    if (wallet === null) {
      throw new Error("Mint needs to be set");
    }

    const storedMintData = JSON.parse(localStorage.getItem("activeMint"));
    const { url, keyset } = storedMintData;

    const proofs = getProofsByAmount(amount, wallet.mint.mintUrl);
    if (proofs.length === 0) {
      throw new Error("Insufficient balance");
    }

    // Ensure wallet has keys loaded before sending
    await wallet.getKeys();

    const response = await wallet.send(amount, proofs);
    const tokenData = {
      mint: wallet.mint.mintUrl,
      proofs: response.send
    };
    const encodedToken = getEncodedToken(tokenData);

    // Store token in localStorage
    storeJSON(encodedToken);

    // Update proofs
    removeProofs(proofs, wallet.mint.mintUrl);
    addProofs(response.keep, wallet.mint.mintUrl);

    return {
      encodedToken,
      tokenData,
      proofs,
      response
    };
  }

  async function handleSend_Ecash(amount) {
    try {
      const { encodedToken, tokenData } = await createEcashToken(amount);

      //Close the sats input modal and display the cashu token modal
      closeSendEcashModal();
      showCashuTokenModal(tokenData);

      addTransaction("Ecash", "Send", wallet.mint.mintUrl, null, amount, null, encodedToken);
    } catch (error) {
      console.error(error);
      showToast(error.message);
      storeJSON({ error: "Failed to send ecash", details: error });
    }
  }

  function addTransaction(type, action, mint, invoice, amount, fee, token) {
    const timestamp = getTimestamp();

    const transaction = {
      type: type,
      created: timestamp,
      action: action,
      mint: mint,
      amount: amount,
    };

    // Add type-specific fields
    if (type === "Ecash") {
      transaction.token = token;
    } else if (type === "Lightning" || type === "Auto Sweep") {
      transaction.invoice = invoice;
      transaction.fee = fee;
    }

    // Retrieve existing transactions from local storage, create key if it doesn't exist
    let existingTransactions = [];
    try {
      const stored = localStorage.getItem("bullishnuts_transactions");
      if (stored === null) {
        // Key doesn't exist, create it with empty array
        localStorage.setItem("bullishnuts_transactions", JSON.stringify([]));
        existingTransactions = [];
        console.log("Created new bullishnuts_transactions key in localStorage");
      } else {
        existingTransactions = JSON.parse(stored);
      }
    } catch (error) {
      console.warn("Error reading transactions from localStorage, creating new key:", error);
      localStorage.setItem("bullishnuts_transactions", JSON.stringify([]));
      existingTransactions = [];
    }

    // Add the new transaction to the beginning of the array
    existingTransactions.unshift(transaction);

    // Store the updated transactions array back in local storage
    try {
      localStorage.setItem("bullishnuts_transactions", JSON.stringify(existingTransactions));
    } catch (error) {
      console.error("Error saving transaction to localStorage:", error);
    }

    // Increment the updateFlag to trigger a re-fetch in Transactions
    setUpdateFlag_Transactions(prev => prev + 1);
  }

  async function handleSend_Lightning() {
    try {
      const input = document.getElementById('send_lightning_input').value;
      var invoice = "";
      if (isLightningInvoice(input)) {
        invoice = input;

        const waitingModal = document.getElementById('waiting_modal');
        document.getElementById('waiting_message').textContent = "Getting melt quote...";
        waitingModal.style.display = 'block';

        const quote = await wallet.createMeltQuote(invoice);
        storeJSON(quote);

        const amount = quote.amount + quote.fee_reserve;
        const proofs = getProofsByAmount(amount, wallet.mint.mintUrl, wallet.keys.id);
        if (proofs.length === 0) {
          waitingModal.style.display = 'none';
          showToast("Insufficient balance");
          return;
        }

        document.getElementById('waiting_message').textContent = "Paying invoice...";

        try {
          // Set a timeout of 10 seconds (10000 milliseconds) for to melt
          const payRes = await withTimeout(
            wallet.meltProofs(quote, proofs, { keysetId: wallet.keys.id }),
            10000
          );

          if (payRes.quote.paid) {
            waitingModal.style.display = 'none';

            setIsLightningModalOpen(false);
            showToast('Invoice paid!');
            removeProofs(proofs, wallet.mint.mintUrl);

            addTransaction("Lightning", "Send", wallet.mint.mintUrl, invoice, quote.amount, quote.fee_reserve);

            var changeArray = { "change": payRes.change };
            storeJSON(changeArray);
            addProofs(payRes.change, wallet.mint.mintUrl);
          }
        } catch (error) {
          // Handle error, whether it's a timeout or another issue
          waitingModal.style.display = 'none';
          console.error("Error occurred:", error.message);
          if (error.message === "Operation timed out") {
            showToast("Payment timed out.");
          } else {
            showToast(`Payment failed: ${error.message}`);
          }
        }
      }
      else { //It must be a Lightning address (but we will check)
        handleSend_LightningAddress_GetCallback(input);
      }
    }
    catch (error) {
      console.error(error);
      storeJSON({ error: "Failed to melt tokens", details: error });
    }
  }

  function isValidLightningAddress(address) {
    // Basic pattern check for username@domain
    const lightningAddressPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return lightningAddressPattern.test(address);
  }

  //This function checks to see if the Lightning address provided is valid, gets the amount of sats to send, and fetches invoice using the callback URL
  async function handleSend_LightningAddress_GetCallback(input) {
    try {
      if (!isValidLightningAddress(input)) {
        showToast("Enter a valid Lightning address");
        return;
      }
      const lightningAddressParts = input.split('@');
      const username = lightningAddressParts[0];
      const domain = lightningAddressParts[1];
      const url = `https://${domain}/.well-known/lnurlp/${username}`;
      const response = await fetchWithTimeout(url);

      // Check if the request was successful
      if (!response.ok) {
        closeSendLightningModal();
        throw new Error(`HTTP error! status: ${response.status}`);
        return;
      }

      const data = await response.json();
      const callback = data.callback;

      //Wait to get amount of sats from user
      setIsLightningModalOpen(false);
      const sats = await showSendLightningAddressModal();
      const millisats = sats * 1000;

      closeSendLightningAddressModal();
      const waitingModal = document.getElementById('waiting_modal');
      document.getElementById('waiting_message').textContent = "Fetching invoice...";
      waitingModal.style.display = 'block';

      //Wait to get invoice using callback URL
      let invoice;
      try {
        invoice = await withTimeout(
          fetchInvoiceFromCallback(callback, millisats),
          5000
        );
      } catch (error) {
        waitingModal.style.display = 'none';
        showToast("Failed to fetch invoice. Operation timed out.");
        //showToast(error);
        return;
      }

      //Wait to get melt quote from mint
      const quote = await wallet.createMeltQuote(invoice);
      document.getElementById('waiting_message').textContent = "Getting melt quote...";
      storeJSON(quote);

      const amount = quote.amount + quote.fee_reserve;
      const proofs = getProofsByAmount(amount, wallet.mint.mintUrl, wallet.keys.id);
      if (proofs.length === 0) {
        waitingModal.style.display = 'none';
        showToast("Insufficient balance");
        return;
      }

      document.getElementById('waiting_message').textContent = "Paying invoice...";

      try {
        // Set a timeout of 10 seconds (10000 milliseconds) for melt
        const payRes = await withTimeout(
          wallet.meltProofs(quote, proofs, { keysetId: wallet.keys.id }),
          10000
        );

        // Handle the result if above succeeds within the timeout
        console.log("Invoice paid:", payRes.quote.paid);
        console.log("Preimage:", payRes.quote.payment_preimage);
        console.log("Change:", payRes.change);

        if (payRes.quote.paid) {
          waitingModal.style.display = 'none';

          const message = quote.amount + ' sat(s) sent to ' + input;
          showToast(message);

          removeProofs(proofs, wallet.mint.mintUrl);
          var changeArray = { "change": payRes.change };
          storeJSON(changeArray);
          addProofs(payRes.change, wallet.mint.mintUrl);
          addTransaction("Lightning", "Send", wallet.mint.mintUrl, invoice, quote.amount, quote.fee_reserve);
        }
      } catch (error) {
        // Handle error, whether it's a timeout or another issue
        waitingModal.style.display = 'none';
        console.error("Error occurred:", error.message);
        if (error.message === "Operation timed out") {
          showToast("Payment timed out.");
        } else {
          showToast(`Payment failed: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(error);
      showToast(error.message);
    }
  }

  async function zapDeezNuts() {
    try {

      if (wallet === null) {
        showToast("Mint needs to be set");
        return;
      }

      const lightningAddress = 'npub1cashuq3y9av98ljm2y75z8cek39d8ux6jk3g6vafkl5j0uj4m5ks378fhq@npub.cash';
      const username = 'npub1cashuq3y9av98ljm2y75z8cek39d8ux6jk3g6vafkl5j0uj4m5ks378fhq';
      const domain = 'npub.cash';
      const callbackURL = `https://${domain}/.well-known/lnurlp/${username}`;
      const response = await fetch(callbackURL);

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

      //Display waiting modal with message
      const waitingModal = document.getElementById('waiting_modal');
      document.getElementById('waiting_message').textContent = "Fetching invoice...";
      closeSendLightningAddressModal();
      waitingModal.style.display = 'block';

      //Wait to get melt quote from mint
      const quote = await wallet.createMeltQuote(invoice);
      document.getElementById('waiting_message').textContent = "Getting melt quote...";
      storeJSON(quote);

      const amount = quote.amount + quote.fee_reserve;

      const storedMintData = JSON.parse(localStorage.getItem("activeMint"));
      const { url, keyset } = storedMintData;

      const proofs = getProofsByAmount(amount, url, wallet.keys.id);
      if (proofs.length === 0) {
        waitingModal.style.display = 'none';
        showToast("Insufficient balance");
        return;
      }

      document.getElementById('waiting_message').textContent = "Paying invoice...";
      const meltProofsResponse = await wallet.meltProofs(quote, proofs);

      if (meltProofsResponse.quote.state == MeltQuoteState.PAID) {
        waitingModal.style.display = 'none';
        //const message = quote.amount + ' sat(s) sent to ' + lightningAddress;
        const message = "Thanks for your support!";
        showToast(message, 5);
        removeProofs(proofs, url);

        var changeArray = { "change": meltProofsResponse.change };
        storeJSON(changeArray);
        addProofs(meltProofsResponse.change, url);
        addTransaction("Lightning", "Donate", url, invoice, quote.amount, quote.fee_reserve);
        showConfetti();
      }
    } catch (error) {
      console.error(error);
      showToast(error);
      storeJSON({ error: "Failed to zap deez nuts", details: error });
    }
  } // End zapDeezNuts

  async function sendNuts(npub, amount, message) {
    try {
      const { encodedToken } = await createEcashToken(amount);

      // Send via Nostr
      let decodedData = decode(npub);
      let hexPubKey = bytesToHex(decodedData.data);

      // Send the message and token separately
      if (message) {
        sendEncryptedMessage(hexPubKey, message);
      }
      sendEncryptedMessage(hexPubKey, encodedToken);

      addTransaction("Ecash", "Donate", wallet.mint.mintUrl, null, amount, null, encodedToken);
      showConfetti();
    } catch (error) {
      console.error(error);
      showToast(error.message);
      storeJSON({ error: "Failed to send nuts", details: error });
    }
  }

  /*
   * Sends a NIP-04 DM to an Nostr user.
   * Receiver should be in the hex pubkey format.
   * 
   * Generates an ephemeral key if one doesn't exist in localStorage.
   */
  async function sendEncryptedMessage(receiver, message) {
    // Check if we have an ephemeral key in localStorage
    let nsecKey = localStorage.getItem('bullishnuts_ephemeralKey');

    if (!nsecKey) {
      // Generate a new ephemeral key
      const secretKey = secp.utils.randomPrivateKey();
      nsecKey = encode('nsec', secretKey);
      localStorage.setItem('bullishnuts_ephemeralKey', nsecKey);
      console.log('Generated new ephemeral key for encrypted messaging');
    }

    try {
      // Decode nsec to get the secret key bytes
      const decodedNsec = decode(nsecKey);
      const secretKey = new Uint8Array(decodedNsec.data);

      let publicKey = getPublicKey(secretKey) // `publicKey` is a hex string
      let sharedPoint = secp.getSharedSecret(secretKey, '02' + receiver)
      let sharedX = sharedPoint.slice(1, 33)

      let iv = crypto.randomFillSync(new Uint8Array(16))
      var cipher = crypto.createCipheriv(
        'aes-256-cbc',
        Buffer.from(sharedX),
        iv
      )

      let encryptedMessage = cipher.update(`${message}`, 'utf8', 'base64')
      encryptedMessage += cipher.final('base64')
      let ivBase64 = Buffer.from(iv.buffer).toString('base64')

      let event = {
        pubkey: [publicKey],
        created_at: Math.floor(Date.now() / 1000),
        kind: 4,
        tags: [['p', receiver]],
        content: encryptedMessage + '?iv=' + ivBase64
      }

      // this assigns the pubkey, calculates the event id and signs the event in a single step
      const signedEvent = finalizeEvent(event, secretKey)

      // Try to publish to multiple relays
      const pool = new SimplePool();
      let relays = ['wss://relay.0xchat.com', 'wss://relay.damus.io', 'wss://relay.primal.net'];
      try {
        await Promise.any(pool.publish(relays, signedEvent));
      } catch (error) {
        console.error(error);
        storeJSON({ error: true, details: error });
      }
    } catch (error) {
      console.error("Error in sendEncryptedMessage:", error);
      storeJSON({ error: "Failed to send encrypted message", details: error });
    }
  }

  async function fetchInvoiceFromCallback(callbackURL, amount, timeout = 5000) {
    const url = new URL(callbackURL);
    const params = {
      amount: amount,
    };
    url.search = new URLSearchParams(params).toString();

    // Use AbortController to handle the timeout
    const controller = new AbortController();
    const signal = controller.signal;

    // Set a timeout to abort the fetch request
    const timeoutID = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { signal });

      // Clear timeout once response is received
      clearTimeout(timeoutID);

      if (!response.ok) {
        throw new Error(`Failed to fetch invoice. HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.pr;
    } catch (error) {
      // Check if the error is due to a timeout
      if (error.name === 'AbortError') {
        console.error(`Request to ${url} timed out after ${timeout} ms`);
        throw new Error(`Failed to fetch invoice. Request timed out.`);
      } else {
        console.error('Error fetching invoice:', error);
        throw new Error(`Failed to fetch invoice. Error: ${error.message}`);
      }
    }
  }

  // Function to fetch data with a timeout
  async function fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const signal = controller.signal;

    // Set a timeout to abort the fetch request
    const timeoutID = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(url, { ...options, signal });
      // Clear the timeout if the fetch is successful
      clearTimeout(timeoutID);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response; // Return the Response object
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Fetch request timed out for [${url}]`);
      }
      throw error; // Rethrow other errors
    }
  }

  function refreshPage() {
    window.location.reload();
  }

  async function showInvoiceModal(invoice) {
    const qrcodeDiv = document.getElementById('invoice_qrcode');

    // Remove any existing QR code
    qrcodeDiv.innerHTML = "";

    // Create a canvas element manually
    const canvas = document.createElement('canvas');
    qrcodeDiv.appendChild(canvas);

    try {
      // Generate QR code directly on the canvas
      await QRCode.toCanvas(canvas, invoice, {
        width: 268,  // Set a static width for testing
        color: {
          dark: "#000000",  // Dots
          light: "#FF9900"  // Background
        },
      });

      console.log("QR code generated successfully on canvas.");

      const invoiceText = document.getElementById('invoiceText');
      invoiceText.value = invoice;

      // Show the modal after generating the QR code
      const modal = document.getElementById('invoiceModal');
      modal.style.display = 'block';
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
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

  function pasteFromClipboard() {
    navigator.clipboard.readText()
      .then(text => {
        if (!text.startsWith('cashu')) {
          //Try to decode the nuts and display the cashu token
          const decodedEmoji = decodeEmoji(text);
          document.getElementById('cashu_token').value = decodedEmoji;
          displayTokenInfo(decodedEmoji);
        } else {
          document.getElementById('cashu_token').value = text;
          displayTokenInfo(text);
        }
      })
      .catch(err => {
        console.error('Failed to read clipboard contents: ', err);
      });
  }

  function displayTokenInfo(token) {
    try {
      const decodedToken = getDecodedToken(token);
      const totalAmount = decodedToken.proofs.reduce((sum, proof) => sum + proof.amount, 0);

      // Update the token info display
      const tokenInfoDiv = document.getElementById('token_info');
      tokenInfoDiv.innerHTML = `
        <div class="token-info">
          <p><strong>Amount:</strong> ${totalAmount} ${totalAmount === 1 ? 'sat' : 'sats'}</p>
          <p><strong>Mint:</strong> ${decodedToken.mint}</p>
        </div>
      `;
    } catch (error) {
      console.error('Error decoding token:', error);
      document.getElementById('token_info').innerHTML = '<p class="error">Invalid token format</p>';
    }
  }

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
      }, 500);

    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  }

  async function copyCashuEmoji() {
    try {
      const token = document.getElementById('send_cashu_token').value;
      const encodedEmoji = encodeEmoji('🥜', token);
      await navigator.clipboard.writeText(encodedEmoji);

      // Change button text to "Copied" temporarily
      const copyEmojiButton = document.getElementById('copy_emoji_button');
      copyEmojiButton.textContent = 'Copied';

      // Reset button text after 1000ms (1 second)
      setTimeout(() => {
        copyEmojiButton.textContent = '🥜';
      }, 500);

    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  }

  //Send modals

  function showSendEcashModal() {
    if (wallet === null) {
      showToast("Mint needs to be set");
      return;
    }
    const modal = document.getElementById('send_ecash_modal');
    modal.style.display = 'block';
  }

  function sendEcashButtonClicked() {
    const amount = parseInt(document.getElementById('ecash_amount').value);
    if (!isNaN(amount) && amount > 0) {
      handleSend_Ecash(amount);
    } else {
      showToast('Please enter a valid amount of sats');
    }
  }

  async function showCashuTokenModal(tokenData) {
    let encodedToken = getEncodedToken(tokenData);
    document.getElementById('send_cashu_token').value = encodedToken;

    // Store the current token data in the hidden input
    document.getElementById('current_token_data').value = JSON.stringify(tokenData);

    // Get the div that will contain the QR code
    const qrCodeDiv = document.getElementById('cashu_token_qrcode');

    await generateQR(qrCodeDiv, encodedToken);

    const modal = document.getElementById('cashu_token_modal');
    modal.style.display = 'block';
  }

  // This function creates a QR code from the encoded token, puts it in a canvas, and add that canvas as a child to the div passed
  async function generateQR(qrCodeDiv, encodedToken) {
    // Remove any existing QR code
    qrCodeDiv.innerHTML = "";

    // Create a canvas element manually
    const canvas = document.createElement('canvas');
    qrCodeDiv.appendChild(canvas);

    try {
      // Generate QR code directly on the canvas
      await QRCode.toCanvas(canvas, encodedToken, {
        width: 268,  // Set a static width for testing
        color: {
          dark: "#000000",  // Dots
          light: "#FF9900"  // Background
        },
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
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

  function closeSendLightningModal() {
    document.getElementById('send_lightning_input').value = '';
  }

  function showSendLightningAddressModal() {
    return new Promise((resolve) => {
      const modal = document.getElementById('send_lightning_address_modal');
      const input = document.getElementById('send_lightning_amount');
      const submitButton = document.getElementById('send_lightning_submit');

      modal.style.display = 'block';

      submitButton.onclick = () => {
        const value = input.value;
        resolve(value);
      };
    });
  }

  function closeSendLightningAddressModal() {
    const modal = document.getElementById('send_lightning_address_modal');
    document.getElementById('send_lightning_amount').value = '';
    modal.style.display = 'none';
  }

  function showReceiveEcashModal(token) {
    const modal = document.getElementById('receive_ecash_modal');

    // If a token is provided, set it in the textarea
    if (token) {
      document.getElementById('cashu_token').value = token;
    }

    // Display the modal
    modal.style.display = 'block';
  }

  function closeReceiveEcashModal() {
    const modal = document.getElementById('receive_ecash_modal');
    document.getElementById('cashu_token').value = '';
    document.getElementById('token_info').innerHTML = '';
    modal.style.display = 'none';
  }

  function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show';

    setTimeout(() => {
      toast.className = 'toast';
    }, duration);
  }

  function showMessageModal(message) {
    const modal = document.getElementById('message_modal');

    // Replace newline characters with <br> tags
    const formattedMessage = message.replace(/\n/g, '<br>');

    document.getElementById('message').innerHTML = formattedMessage;
    modal.style.display = 'block';
  }

  const showTypewriterModal = (messagesArray) => {
    setTypewriterMessages(messagesArray);

    const modal = document.getElementById('typewriter_modal');
    modal.style.display = 'block';

    setIsTypewriterModalOpen(true);
  };

  const closeTypewriterModal = () => {
    const modal = document.getElementById('typewriter_modal');
    modal.style.display = 'none';

    setIsTypewriterModalOpen(false);
  };

  function showMessageWithGif(text) {
    const messageElement = document.getElementById('message');
    messageElement.innerHTML = ''; // Clear any existing text

    // Replace newline characters with <br> tags
    const formattedText = text.replace(/\n/g, '<br>');

    let index = 0;
    const interval = setInterval(() => {
      if (index < formattedText.length) {
        messageElement.innerHTML += formattedText[index];
        index++;
      } else {
        clearInterval(interval);
      }
    }, 50); // Adjust the interval speed as needed

    // Show the modal
    document.getElementById('message_modal').style.display = 'block';
  }

  function closeMessageModal() {
    const modal = document.getElementById('message_modal');
    modal.style.display = 'none';
  }

  function getTimestamp() {
    const date = new Date();
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,  // 24-hour format
    };

    // Extract parts from the formatted date string
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);

    const year = parts.find(part => part.type === 'year').value;
    const month = parts.find(part => part.type === 'month').value;
    const day = parts.find(part => part.type === 'day').value;
    const hour = parts.find(part => part.type === 'hour').value;
    const minute = parts.find(part => part.type === 'minute').value;
    const second = parts.find(part => part.type === 'second').value;

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  function storeJSON(json) {
    // Generate a timestamp to use as the key
    const timestamp = getTimestamp();

    // Retrieve existing data from local storage
    const existingData = JSON.parse(localStorage.getItem('json')) || {};

    // Add new data with timestamp as the key
    existingData[timestamp] = json;

    // Store the updated data back in local storage
    localStorage.setItem('json', JSON.stringify(existingData));
  }

  const handleContactSelect = async (contact) => {
    let npub = contact.npub; // Move this line up to define npub before using it

    // let { amount, message } = await showSendNutsModal(npub);
    // closeSendNutsModal();
    // await sendNuts(npub, amount, message);
    // showToast(`${amount} sats sent to ${npub} via Nostr DM`)

    //Uncomment the following lines if you want to copy the contact address to clipboard
    const contactAddress = `${npub}@npub.cash`;
    navigator.clipboard.writeText(contactAddress).then(() => {
      showToast(`Copied to clipboard: ${contactAddress}`);
    }).catch(err => {
      showToast(`Failed to copy: ${err}`);
    });
  };

  //Receive modals

  function showReceiveLightningModal() {
    if (wallet === null) {
      showToast("Mint needs to be set");
      return;
    }
    const modal = document.getElementById('receive_lightning_modal');
    modal.style.display = 'block';
  }

  function closeReceiveLightningModal() {
    const modal = document.getElementById('receive_lightning_modal');
    document.getElementById('receive_lightning_amount').value = '';
    modal.style.display = 'none';
  }

  function createInvoiceButtonClicked() {
    const amount = parseInt(document.getElementById('receive_lightning_amount').value);
    if (!isNaN(amount) && amount > 0) {
      handleReceive_Lightning(amount);
    } else {
      showToast('Please enter a valid amount of sats');
    }
  }

  function claimButtonClicked() {
    const cashuToken = document.getElementById('cashu_token').value;
    if (cashuToken !== null) {
      handleReceive_Ecash(cashuToken);
    } else {
      showToast('Please paste a cashu token');
    }
  }

  // Simplified Send Nuts functions
  const handleOpenSendNutsModal = () => {
    const modal = document.getElementById('send_nuts_modal');
    modal.style.display = 'block';
  };

  const handleCloseSendNutsModal = () => {
    const modal = document.getElementById('send_nuts_modal');
    document.getElementById('send_nuts_amount').value = '';
    document.getElementById('send_nuts_message').value = '';
    modal.style.display = 'none';
  };

  const handleSendNutsSubmit = () => {
    const amount = parseInt(document.getElementById('send_nuts_amount').value);
    const message = document.getElementById('send_nuts_message').value;

    if (!isNaN(amount) && amount > 0) {
      const receiver = 'npub1cashuq3y9av98ljm2y75z8cek39d8ux6jk3g6vafkl5j0uj4m5ks378fhq';
      sendNuts(receiver, amount, message);
      handleCloseSendNutsModal();
    } else {
      showToast('Please enter a valid amount of sats');
    }
  };

  const exportJSON = () => {
    const existingData = JSON.parse(localStorage.getItem('json')) || {};
    const dataStr = JSON.stringify(existingData);
    const blob = new Blob([dataStr], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = getTimestamp();
    a.download = `bullishNuts_logs_${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAutoSweepSave = (targetBalance, lightningAddress) => {
    // Handle the save logic here
    console.log('Auto Sweep Settings:', { targetBalance, lightningAddress });
  };

  // function showConfetti(confettiNumber = 21) {
  //   if (jsConfettiRef.current) {
  //     jsConfettiRef.current.addConfetti({
  //       emojis: ['🐂', '🥜', '⚡️'],
  //       emojiSize: 150,
  //       confettiNumber: confettiNumber,
  //     });
  //   }
  // }

  function showConfetti(confettiNumber = 21) {
    if (jsConfettiRef.current) {
      const confettiInterval = 1; // Time in milliseconds between each confetti burst
      const totalConfetti = confettiNumber; // Total number of confetti pieces you want to show
      let confettiCount = 0; // Counter for how many confetti pieces have been shown

      const intervalId = setInterval(() => {
        if (confettiCount < totalConfetti) {
          jsConfettiRef.current.addConfetti({
            emojis: ['🐂', '🥜', '⚡️'],
            emojiSize: 150,
            confettiNumber: 1, // Add one piece of confetti at a time
          });
          confettiCount++;
        } else {
          clearInterval(intervalId); // Stop the interval when done
        }
      }, confettiInterval);

    }
  }

  async function checkProofs() {
    const storedMintData = JSON.parse(localStorage.getItem("activeMint"));
    const proofs = getAllProofs(storedMintData.url);
    if (proofs.length === 0) {
      showToast("No proofs to check");
      return;
    }

    const proofStates = await wallet.checkProofsStates(proofs);
    const spentProofs = [];

    for (let i = 0; i < proofStates.length; i++) {
      const currentProofState = proofStates[i];

      // Check if the state is equal to CheckStateEnum.SPENT
      if (currentProofState.state === CheckStateEnum.SPENT) {
        spentProofs.push(proofs[i]);
      }
    }

    removeProofs(spentProofs, storedMintData.url);
    showToast(`Deleted ${spentProofs.length} proofs`);
  }

  const openEcashOrLightningModal = (label) => {
    setEcashOrLightningModalLabel(label);
    setIsEcashOrLightningOpen(true);
  };

  const closeEcashOrLightningModal = () => {
    setIsEcashOrLightningOpen(false);
  };

  const handleOptionSelect = (option) => {
    const action = ecashOrLightningModalLabel;
    console.log(`Selected ${option} for ${action}`);
    setIsEcashOrLightningOpen(false); // Close modal after selection

    if (action === "Send") {
      if (option === "Ecash") {
        showSendEcashModal();
      }
      else if (option === "Lightning") {
        setIsLightningModalOpen(true);
      }
    }
    else if (action === "Receive") {
      if (option === "Ecash") {
        showReceiveEcashModal();
      }
      else if (option === "Lightning") {
        showReceiveLightningModal();
      }
    }
  };

  // Function to add a timeout to any promise
  const withTimeout = (promise, timeout) => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout} ms`)), timeout)
      ),
    ]);
  };

  const showQRCodeScanner = () => {
    setIsScanQRModalOpen(true);
  };

  const closeQRCodeScanner = () => {
    setIsScanQRModalOpen(false);
  }

  const toggleBalance = () => {
    const newState = !isBalanceHidden;
    setIsBalanceHidden(newState);
    localStorage.setItem('isBalanceHidden', newState);
  };

  const closeNutSplitsModal = () => {
    setIsNutSplitsModalOpen(false);
  }

  // Merch Modal functions
  const handleOpenMerchModal = () => {
    setIsMerchModalOpen(true);
    setSelectedProducts([]);
    setMerchTotal(0);
    document.body.style.overflow = 'hidden';
  };

  const handleCloseMerchModal = () => {
    setIsMerchModalOpen(false);
    setSelectedProducts([]);
    setMerchTotal(0);
    document.body.style.overflow = 'auto';
  };

  const handleProductQuantityChange = (productId, newQuantity) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    let updatedProducts = [...selectedProducts];
    const existingIndex = updatedProducts.findIndex(p => p.id === productId);

    if (newQuantity <= 0) {
      // Remove product if quantity is 0 or negative
      if (existingIndex !== -1) {
        updatedProducts.splice(existingIndex, 1);
      }
    } else {
      // Update or add product
      if (existingIndex !== -1) {
        updatedProducts[existingIndex] = { ...product, quantity: newQuantity };
      } else {
        updatedProducts.push({ ...product, quantity: newQuantity });
      }
    }

    setSelectedProducts(updatedProducts);
    
    // Calculate total
    const total = updatedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    setMerchTotal(total);
  };

  const handleMerchNext = () => {
    if (selectedProducts.length === 0) {
      showToast("Please select at least one product");
      return;
    }
    setIsMerchModalOpen(false);
    setIsMerchPaymentModalOpen(true);
    // Keep overflow hidden since we're transitioning to another modal
  };

  const handleCloseMerchPaymentModal = () => {
    setIsMerchPaymentModalOpen(false);
    setSelectedProducts([]);
    setMerchTotal(0);
    document.body.style.overflow = 'auto';
  };

  const handleMerchPaymentSubmit = () => {
    const amount = parseInt(document.getElementById('merch_payment_amount').value);
    const message = document.getElementById('merch_payment_message').value;
    
    if (amount !== merchTotal) {
      showToast("Amount must match the total price");
      return;
    }

    // Create order summary
    const orderSummary = selectedProducts.map(p => 
      `${p.name} x${p.quantity} (${p.price * p.quantity} sats)`
    ).join(', ');

    const finalMessage = message ? `${message}\n\nOrder: ${orderSummary}` : `Order: ${orderSummary}`;
    
    const receiver = 'npub1cashuq3y9av98ljm2y75z8cek39d8ux6jk3g6vafkl5j0uj4m5ks378fhq';
    sendNuts(receiver, amount, finalMessage);
    handleCloseMerchPaymentModal();
  };

  const handleNutSplit = async (selectedCommenters) => {
    try {
      setIsNutSplitsModalOpen(false); // Close the modal

      selectedCommenters = ['npub1cashuq3y9av98ljm2y75z8cek39d8ux6jk3g6vafkl5j0uj4m5ks378fhq',
        'npub15ypxpg429uyjmp0zczuza902chuvvr4pn35wfzv8rx6cej4z8clq6jmpcx'];

      console.log('Selected Commenters:', selectedCommenters);

      let amount = 1;
      let totalAmount = amount * selectedCommenters.length;
      let message = "This is a test nut!";

      const waitTime = 1000; // Wait time in milliseconds (e.g., 1000 ms = 1 second)
      // Function to create a delay
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      // Loop through each commenter
      for (const npub of selectedCommenters) {
        await sendNuts(npub, amount, message);
        console.log('Nut(s) sent to:', npub);
        // Wait for the specified time before the next iteration
        await delay(waitTime);
      }

      // const proofs = getProofsByAmount(totalAmount, wallet.mint.mintUrl);
      // if (proofs.length === 0) {
      //   showToast("Insufficient balance");
      //   return;
      // }

      // // Step 1: Calculate the total amount of all proofs
      // let totalAmountProofs = 0;
      // for (let i = 0; i < proofs.length; i++) {
      //   totalAmountProofs += proofs[i].amount; // Assuming each proof has an 'amount' property
      // }

      // // Create the sendAmounts array
      // const sendAmounts = new Array(selectedCommenters.length).fill(amount); // Fill with amount to send each npub

      // // Calculate the total of sendAmounts
      // const totalSendAmounts = sendAmounts.reduce((acc, amount) => acc + amount, 0);

      // // Calculate the keepAmounts
      // const keepAmounts = new Array(totalAmountProofs - totalSendAmounts).fill(1);

      // // Get all tokens in one call to the mint
      // await wallet.getKeys();
      // const mintInfo = await wallet.mint.getInfo();
      // const result = await wallet.send(8, proofs, {
      //   outputAmounts: { sendAmounts: Array(5).fill(1), keepAmounts: [1] }
      // });

      // removeProofs(proofs, wallet.mint.mintUrl);
      // addProofs(result.keep, wallet.mint.mintUrl);

      // // Loop through each commenter and send out tokens
      // for (let i = 0; i < selectedCommenters.length; i++) {
      //   const npub = selectedCommenters[i]; // Access the current npub using the index
      //   let decodedData = decode(npub);
      //   let currentHexPubKey = bytesToHex(decodedData.data);
      //   sendEncryptedMessage(currentHexPubKey, message);

      //   const currentTokenData = {
      //     mint: wallet.mint.mintUrl,
      //     proofs: [result.send[i]]
      //   };
      //   const cashuString = getEncodedToken(currentTokenData);
      //   sendEncryptedMessage(currentHexPubKey, cashuString);

      //   console.log('Nut(s) sent to:', npub);
      // }

      showToast(`Sent ${amount} sat(s) each to ${selectedCommenters.length} recipients`);
    } catch (error) {
      console.error("handleNutSplit() =>", error);
    }
  };

  return (
    <main>
      <div className="app-container">

        <div className="app_header">
          <h2>
            <b><button onClick={() => showConfetti()}>bullishNuts</button></b>
            <small style={{ marginLeft: '3px', marginTop: '1px' }}>v{packageJson.version}</small>
          </h2>
          <div id="refresh-icon" onClick={refreshPage}><RefreshIcon style={{ height: '21px', width: '21px' }} /></div>
        </div>

        <div id="toast" className="toast">This is a toast message.</div>

        {/* Message modal */}
        <div id="message_modal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeMessageModal}>&times;</span>
            <p id="message"></p>
            <button className="styled-button" onClick={closeMessageModal}>LFG</button>
          </div>
        </div>

        <div id="typewriter_modal" className="modal">
          {isTypewriterModalOpen && (
            <TypewriterModal
              messages={typewriterMessages}
              onClose={closeTypewriterModal}
            />
          )}
        </div>

        {/* Invoice modal */}
        <div id="invoiceModal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeInvoiceModal}>&times;</span>
            <p>Invoice</p>
            <div id="invoice_qrcode"></div>
            <textarea id="invoiceText" readOnly></textarea>
            <button id="copyButton" className="styled-button" onClick={copyToClipboard}>Copy</button>
          </div>
        </div>

        <div className="section">
          <h2>Balance</h2>
          <p style={{ fontSize: '21px' }} onClick={toggleBalance}>{isBalanceHidden ? '***' : `${balance} ${balance === 1 ? 'sat' : 'sats'}`}</p>
          <div className="button-container">
            <button className="styled-button" onClick={() => openEcashOrLightningModal('Send')}>
              Send<SendIcon style={{ height: '21px', width: '21px', minHeight: '21px', minWidth: '21px', marginLeft: '5px' }} />
            </button>
            <button className="qr-code-button" onClick={showQRCodeScanner}>
              <QrCodeIcon style={{ height: '42px', width: '42px' }} />
            </button>
            {isScanQRModalOpen &&
              <QRCodeScanner
                onClose={closeQRCodeScanner}
                isScanQRModalOpen={isScanQRModalOpen}
                onScan={handleQRScan}
              />}
            <button className="styled-button" onClick={() => openEcashOrLightningModal('Receive')}>
              Receive<ReceiveIcon style={{ height: '21px', width: '21px', minHeight: '21px', minWidth: '21px', marginLeft: '5px' }} />
            </button>
          </div>
          <EcashOrLightning
            isOpen={isEcashOrLightningOpen}
            onClose={closeEcashOrLightningModal}
            onOptionSelect={handleOptionSelect}
            label={ecashOrLightningModalLabel}
          />
        </div>

        <div className="section">
          <Transactions
            updateFlag_Transactions={updateFlag_Transactions}
          />
        </div>

        <div className="section">
          <Mints
            balance={balance}
            onMintChange={handleMintChange}
          />
        </div>

        {isLightningModalOpen && (
          <LightningModal
            contacts={contacts}
            onClose={() => setIsLightningModalOpen(false)}
            onSend={handleSend_Lightning}
            isLightningModalOpen={isLightningModalOpen}
            initialValue={lightningModalInitValue}
          />
        )}

        {/* Send ecash modal */}
        <div id="send_ecash_modal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeSendEcashModal}>&times;</span>
            <h2>Send Ecash</h2>
            <input type="number" id="ecash_amount" name="ecash_amount" placeholder="Enter amount of sats" inputMode="decimal" min="1" />
            <button className="styled-button" onClick={sendEcashButtonClicked}>Create Token</button>
          </div>
        </div>

        {/* Cashu token modal */}
        <div id="cashu_token_modal" className="modal">
          <div className="modal-content">
            <input type="hidden" id="current_token_data" />
            <span className="close-button" onClick={closeCashuTokenModal}>&times;</span>
            <h2>Cashu token</h2>
            <div id="cashu_token_qrcode"></div>
            <textarea id="send_cashu_token" readOnly></textarea>
            <div className="button-container">
              <button id="copy_token_button" className="styled-button" onClick={copyCashuToken}>Copy</button>
              <button id="copy_emoji_button" className="styled-button" onClick={copyCashuEmoji}>🥜</button>
            </div>
          </div>
        </div>

        {/* Send Lightning address modal */}
        <div id="send_lightning_address_modal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeSendLightningAddressModal}>&times;</span>
            <label htmlFor="send_lightning_amount">Enter amount of sats:</label>
            <input type="number" id="send_lightning_amount" inputMode="decimal" min="1" />
            <button className="styled-button" id="send_lightning_submit">Send</button>
          </div>
        </div>

        {/* Waiting modal */}
        <div className="modal" id="waiting_modal">
          <div className="modal-content">
            <div className="progress-bar-container">
              <div className="progress-bar"></div>
            </div>
            <p id="waiting_message"></p>
          </div>
        </div>

        {/* Receive ecash modal */}
        <div id="receive_ecash_modal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeReceiveEcashModal}>&times;</span>
            <label htmlFor="cashu_token">
              <button className="orange-button" onClick={pasteFromClipboard}>Paste</button> Cashu token
            </label>
            <textarea id="cashu_token" onChange={(e) => displayTokenInfo(e.target.value)}></textarea>
            <div id="token_info"></div>
            <button className="styled-button" onClick={claimButtonClicked}>Claim</button>
          </div>
        </div>

        {/* Receive Lightning modal */}
        <div id="receive_lightning_modal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeReceiveLightningModal}>&times;</span>
            <h2>Receive Lightning</h2>
            <input type="number" id="receive_lightning_amount" placeholder="Enter amount of sats" inputMode="decimal" min="1" />
            <button className="styled-button" onClick={createInvoiceButtonClicked}>Create invoice</button>
          </div>
        </div>

        <div className="section">
          <Contacts
            onContactSelect={handleContactSelect}
            updateContacts={updateContacts}
          />
        </div>

        <div className="section">
          <h2>Support</h2>
          <div className="button-container">
            <button className="styled-button" onClick={zapDeezNuts} >ZAP DEEZ NUTS<LightningIcon style={{ height: '21px', width: '21px', marginLeft: '3px' }} /></button>
          </div>
          <div className="button-container">
            <button className="styled-button" onClick={() => handleOpenSendNutsModal()}>SEND NUTS 🥜</button>
          </div>
          <div className="button-container">
            <button className="styled-button" onClick={handleOpenMerchModal}>BUY MERCH 🛍️</button>
          </div>
        </div>

        {/* Send Nuts Modal */}
        <div id="send_nuts_modal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={handleCloseSendNutsModal}>&times;</span>
            <h2>Send Nuts</h2>
            <label htmlFor="send_nuts_amount">Amount of sats:</label>
            <input type="number" id="send_nuts_amount" inputMode="decimal" min="1" />
            <label htmlFor="send_nuts_message">Message (optional):</label>
            <textarea id="send_nuts_message"></textarea>
            <button className="styled-button" onClick={handleSendNutsSubmit}>Send Nuts</button>
          </div>
        </div>

        {/* Merch Product Selection Modal */}
        {isMerchModalOpen && (
          <div className="modal" style={{ display: 'block' }}>
            <div className="modal-content">
              <span className="close-button" onClick={handleCloseMerchModal}>&times;</span>
              <h2>Select Products</h2>
              <div className="products-list">
                {products.map((product) => {
                  const selectedProduct = selectedProducts.find(p => p.id === product.id);
                  const quantity = selectedProduct ? selectedProduct.quantity : 0;
                  
                  return (
                    <div key={product.id} className="product-item">
                      <div className="product-info">
                        <img 
                          src={product.thumbnail} 
                          alt={product.name} 
                          className="product-thumbnail"
                        />
                        <div className="product-details">
                          <h3>{product.name}</h3>
                          <p className="product-price">{product.price} sats</p>
                          <p className="product-description">{product.description}</p>
                        </div>
                      </div>
                      <div className="product-quantity">
                        <button 
                          className="quantity-btn"
                          onClick={() => handleProductQuantityChange(product.id, quantity - 1)}
                          disabled={quantity <= 0}
                        >
                          -
                        </button>
                        <span className="quantity-display">{quantity}</span>
                        <button 
                          className="quantity-btn"
                          onClick={() => handleProductQuantityChange(product.id, quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="merch-total">
                <h3>Total: {merchTotal} sats</h3>
              </div>
              <button 
                className="styled-button" 
                onClick={handleMerchNext}
                disabled={selectedProducts.length === 0}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Merch Payment Modal */}
        {isMerchPaymentModalOpen && (
          <div className="modal" style={{ display: 'block' }}>
            <div className="modal-content">
              <span className="close-button" onClick={handleCloseMerchPaymentModal}>&times;</span>
              <h2>Complete Purchase</h2>
              <div className="order-summary">
                <h3>Order Summary:</h3>
                {selectedProducts.map((product) => (
                  <div key={product.id} className="order-item">
                    <span>{product.name} x{product.quantity}</span>
                    <span>{product.price * product.quantity} sats</span>
                  </div>
                ))}
                <div className="order-total">
                  <strong>Total: {merchTotal} sats</strong>
                </div>
              </div>
              <label htmlFor="merch_payment_amount">Amount of sats:</label>
              <input 
                type="number" 
                id="merch_payment_amount" 
                inputMode="decimal" 
                min="1" 
                defaultValue={merchTotal}
                readOnly
              />
              <label htmlFor="merch_payment_message">Message (optional):</label>
              <textarea id="merch_payment_message" placeholder="Add any special instructions..."></textarea>
              <button className="styled-button" onClick={handleMerchPaymentSubmit}>Complete Purchase</button>
            </div>
          </div>
        )}

        <div className="data-display-container">
          <h2>Moar Features</h2>
          <div className="button-container">
            <button className="styled-button" onClick={() => setIsAutoSweepModalOpen(true)}>
              Auto Sweep
            </button>
          </div>
          <div className="button-container">
            <button className="styled-button" onClick={checkProofs}>
              Check Proofs<CheckIcon style={{ height: '21px', width: '21px', marginLeft: '3px', marginBottom: '3px' }} />
            </button>
          </div>
          <div className="button-container">
            <button className="styled-button" onClick={exportJSON}>
              Export JSON Logs<ExportIcon style={{ height: '21px', width: '21px', marginLeft: '3px', marginBottom: '3px' }} />
            </button>
          </div>
          <AutoSweepModal
            open={isAutoSweepModalOpen}
            onClose={() => setIsAutoSweepModalOpen(false)}
            onSave={handleAutoSweepSave}
          />
          {/* <div className="button-container">
            <button className="styled-button" onClick={() => setIsNutSplitsModalOpen(true)}>Nut Splits</button>
            {isNutSplitsModalOpen && (
              <NutSplits
                onSendNuts={handleNutSplit}
                onClose={closeNutSplitsModal}
              />
            )}
          </div> */}
        </div>

        <br></br>

        <div className="centered-container">
          <div className="button-container" style={{ marginBottom: '10px' }}>
            <a href="https://njump.me/npub1cashuq3y9av98ljm2y75z8cek39d8ux6jk3g6vafkl5j0uj4m5ks378fhq" target="_blank" rel="noopener noreferrer">
              <img src="/images/nostr-orange.png" alt="Nostr icon" style={{ height: '33px', marginTop: '2px' }} />
            </a>
            <a href="https://simplex.chat/contact#/?v=2-7&smp=smp%3A%2F%2F1OwYGt-yqOfe2IyVHhxz3ohqo3aCCMjtB-8wn4X_aoY%3D%40smp11.simplex.im%2FOdneEQIS5ONmyX_gTFJmAZWTdBi6ueMD%23%2F%3Fv%3D1-3%26dh%3DMCowBQYDK2VuAyEARR3S-y3Gga4bRRi23CIrZYhtg8G21jbKgl861DN9NW0%253D%26srv%3D6ioorbm6i3yxmuoezrhjk6f6qgkc4syabh7m3so74xunb5nzr4pwgfqd.onion" target="_blank" rel="noopener noreferrer">
              <img src="/images/simplex-svgrepo-com.png" alt="SimpleX icon" style={{ height: '33px' }} />
            </a>
            <a href="https://github.com/thebullishbitcoiner/bullishnuts" target="_blank" rel="noopener noreferrer">
              <img src="/images/github-svgrepo-com.png" alt="GitHub icon" style={{ height: '33px' }} />
            </a>
          </div>
          <p style={{ fontSize: '14px' }}>
            Made with 🐂 by <a href="https://thebullishbitcoiner.com" target="_blank" rel="noopener noreferrer">thebullishbitcoiner</a>
          </p>

        </div>

      </div>

    </main >
  );

};

export default Wallet;
