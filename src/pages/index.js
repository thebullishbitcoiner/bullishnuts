import useMultiMintStorage from "@/hooks/useMultiMintStorage";
import { CashuMint, CashuWallet, getEncodedToken, getDecodedToken, getEncodedTokenV4 } from "@cashu/cashu-ts";
import React, { useState, useEffect, useRef } from "react";

// Custom components
import Contacts from "@/components/Contacts";
import LightningModal from '@/components/LightningModal';
import Mints from "@/components/Mints";
import EcashOrLightning from "@/components/EcashOrLightning";
import Transactions from "@/components/Transactions";

import QRCode from 'qrcode';
import JSConfetti from 'js-confetti';

//Nostr
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import crypto from 'crypto'
import * as secp from '@noble/secp256k1'
import { Relay } from 'nostr-tools/relay'

import TypewriterModal from '@/components/TypewriterModal';
import { RefreshIcon, SendIcon, ReceiveIcon, LightningIcon, CheckIcon, ExportIcon } from "@bitcoin-design/bitcoin-icons-react/filled";

const Wallet = () => {
  const [isLightningModalOpen, setIsLightningModalOpen] = useState(false);
  const [isEcashOrLightningOpen, setIsEcashOrLightningOpen] = useState(false);
  const [ecashOrLightningModalLabel, setEcashOrLightningModalLabel] = useState("");
  const [contacts, setContacts] = useState([]);
  const [updateFlag_Transactions, setUpdateFlag_Transactions] = useState(0);

  const [typewriterMessages, setTypewriterMessages] = useState([]);
  const [isTypewriterModalOpen, setIsTypewriterModalOpen] = useState(false);

  const jsConfettiRef = useRef(null); // Create a ref to store the jsConfetti instance

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

      setFormData((prevData) => ({ ...prevData, mintUrl: url }));
    }
    else {
      const introMessages = [
        "bullishNuts is an ecash wallet that's in its early beta phase with the goal of making your interactions with Cashu simple and fun!",
        "Since this is a progressive web app (PWA), you can easily add this app to your device's home screen for quick access, just like a native app!",
        "Also, since it's a PWA, your ecash tokens are stored in your browser's local storage. Keep that in mind and sweep your sats out before deleting your browser data.",
        "Please use at your own risk with a small amount of sats at a time.",
        "Lastly, reach out on Nostr if you run into any issues.",
        "Have fun playing with your bitcoin! 🤙"
      ];
      showTypewriterModal(introMessages);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleMintChange = async (newMint) => {
    try {
      const mint = new CashuMint(newMint);
      const info = await mint.getInfo();
      setDataOutput(info);

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

  async function handleReceive_Lightning(amount) {
    if (wallet === null) {
      showToast("Mint needs to be set");
      return;
    }
    //const quote = await wallet.getMintQuote(amount);
    const quote = await wallet.createMintQuote(amount);

    setDataOutput(quote);
    storeJSON(quote);

    //Close the receive Lightning modal just before showing the invoice modal
    closeReceiveLightningModal();
    showInvoiceModal(quote.request);

    const intervalId = setInterval(async () => {
      try {
        const { proofs } = await wallet.mintTokens(amount, quote.quote, {
          keysetId: wallet.keys.id,
        });
        setDataOutput({ "minted proofs": proofs });

        //Add new proofs to local storage
        var proofsArray = { "proofs": proofs };
        storeJSON(proofsArray);

        //Add new proofs to existing ones
        addProofs(proofs, wallet.mint.mintUrl);
        closeInvoiceModal();
        const totalAmount = getTotalAmountFromProofs(proofs);
        addTransaction_Lightning("Receive", wallet.mint.mintUrl, quote.request, totalAmount, "--");
        showToast(`${amount} sat${amount !== 1 ? 's' : ''} received`);

        clearInterval(intervalId);
      } catch (error) {
        console.error("Quote probably not paid: ", quote.request, error);
        setDataOutput({ timestamp: new Date().toLocaleTimeString(), error: "Failed to mint", details: error });
      }
    }, 5000);
  }

  async function handleReceive_Ecash(token) {
    try {
      const decoded = getDecodedToken(token);
      const mintURL = decoded.token[0].mint;

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
          setDataOutput(mintInfo);
          storeJSON(mintInfo);

          const { keysets } = await mint.getKeys();

          const satKeyset = keysets.find((k) => k.unit === "sat");
          const newWallet = new CashuWallet(mint, { keys: satKeyset, unit: "sat" });
          const proofs = await newWallet.receive(token);

          addProofs(proofs, mintURL);
          closeReceiveEcashModal();
          const totalAmount = getTotalAmountFromProofs(proofs);
          addTransaction_Ecash("Receive", mintURL, totalAmount, token);
          showToast(`Received ${totalAmount} ${totalAmount === 1 ? 'sat' : 'sats'}!`);

          return;
        } catch (error) {
          console.error(error);
          setDataOutput({ error: "Failed to receive ecash.", details: error });
        }
      }

      const proofs = await currentWallet.receive(token);
      addProofs(proofs, mintURL);
      closeReceiveEcashModal();
      const totalAmount = getTotalAmountFromProofs(proofs);
      addTransaction_Ecash("Receive", mintURL, totalAmount, token);
      showToast(`Received ${totalAmount} ${totalAmount === 1 ? 'sat' : 'sats'}!`);

      setDataOutput(proofs);
      storeJSON(proofs);
    } catch (error) {
      console.error(error);
      closeReceiveEcashModal();
      showToast("Failed to claim token");
    }
  }

  const getTotalAmountFromProofs = (proofs) => {
    return proofs.reduce((total, proof) => {
      return total + proof.amount;
    }, 0);
  };

  async function handleSend_Ecash(amount) {
    const storedMintData = JSON.parse(localStorage.getItem("activeMint"));
    const { url, keyset } = storedMintData;
    const proofs = getProofsByAmount(amount, url);

    if (proofs.length === 0) {
      showToast("Insufficient balance");
      return;
    }

    try {
      const { send, returnChange } = await wallet.send(amount, proofs);
      const tokenData = {
        token: [{ proofs: send, mint: wallet.mint.mintUrl }],
      };
      const encodedToken = getEncodedToken(tokenData)

      //Close the sats input modal and display the cashu token modal
      closeSendEcashModal();
      showCashuTokenModal(tokenData);

      //Add token to local storage
      storeJSON(encodedToken);

      removeProofs(proofs, wallet.mint.mintUrl);
      addProofs(returnChange, wallet.mint.mintUrl);
      addTransaction_Ecash("Send", wallet.mint.mintUrl, amount, encodedToken);

      setDataOutput(encodedToken);
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to send ecash", details: error });
    }
  }

  // Handles adding a transaction to localStorage
  function addTransaction_Ecash(action, mint, amount, token) {
    const timestamp = getTimestamp();

    const transaction = {
      type: "Ecash",
      created: timestamp,
      action: action,
      mint: mint,
      amount: amount,
      token: token,
    };

    // Retrieve existing transactions from local storage
    const existingTransactions = JSON.parse(localStorage.getItem("transactions")) || [];

    // Add the new transaction to the beginning of the array
    existingTransactions.unshift(transaction);

    // Store the updated transactions array back in local storage
    localStorage.setItem("transactions", JSON.stringify(existingTransactions));

    // Increment the updateFlag to trigger a re-fetch in Transactions
    setUpdateFlag_Transactions(prev => prev + 1);
  }

  function addTransaction_Lightning(action, mint, invoice, amount, fee) {
    const timestamp = getTimestamp();

    const transaction = {
      type: "Lightning",
      created: timestamp,
      action: action,
      mint: mint,
      invoice: invoice,
      amount: amount,
      fee: fee,
    };

    // Retrieve existing transactions from local storage
    const existingTransactions = JSON.parse(localStorage.getItem("transactions")) || [];

    // Add the new transaction to the beginning of the array
    existingTransactions.unshift(transaction);

    // Store the updated transactions array back in local storage
    localStorage.setItem("transactions", JSON.stringify(existingTransactions));

    // Increment the updateFlag to trigger a re-fetch in Transactions
    setUpdateFlag_Transactions(prev => prev + 1);
  }

  async function handleSend_Lightning() {
    try {
      const input = document.getElementById('send_lightning_input').value;
      const isInvoiceBolt11 = input.startsWith("lnbc");
      var invoice = "";
      if (isInvoiceBolt11) {
        invoice = input;

        const quote = await wallet.createMeltQuote(invoice);

        setDataOutput([{ "got melt quote": quote }]);
        storeJSON(quote);

        const amount = quote.amount + quote.fee_reserve;
        const proofs = getProofsByAmount(amount, wallet.mint.mintUrl, wallet.keys.id);
        if (proofs.length === 0) {
          showToast("Insufficient balance");
          return;
        }
        const { isPaid, preimage, change } = await wallet.meltTokens(quote, proofs, {
          keysetId: wallet.keys.id,
        });
        if (isPaid) {
          setIsLightningModalOpen(false);
          //closeSendLightningModal();
          showToast('Invoice paid!');
          removeProofs(proofs, wallet.mint.mintUrl);

          addTransaction_Lightning("Send", wallet.mint.mintUrl, invoice, amount, quote.fee_reserve);

          var changeArray = { "change": change };
          storeJSON(changeArray);
          addProofs(change, wallet.mint.mintUrl);
        }
      }
      else { //It must be a Lightning address (but we will check)
        handleSend_LightningAddress_GetCallback(input);
      }
    }
    catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to melt tokens", details: error });
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
      setDataOutput([{ "got melt quote": quote }]);
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
        // Set a timeout of 10 seconds (10000 milliseconds) for meltTokens
        const { isPaid, preimage, change } = await withTimeout(
          wallet.meltTokens(quote, proofs, { keysetId: wallet.keys.id }),
          5000
        );

        // Handle the result if meltTokens succeeds within the timeout
        console.log("Invoice paid:", isPaid);
        console.log("Preimage:", preimage);
        console.log("Change:", change);

        if (isPaid) {
          waitingModal.style.display = 'none';

          const message = quote.amount + ' sat(s) sent to ' + input;
          showToast(message);
          
          removeProofs(proofs, wallet.mint.mintUrl);
          var changeArray = { "change": change };
          storeJSON(changeArray);
          addProofs(change, wallet.mint.mintUrl);

          addTransaction_Lightning("Send", wallet.mint.mintUrl, invoice, quote.amount, quote.fee_reserve);
        }
      } catch (error) {
        // Handle error, whether it's a timeout or another issue
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
      setDataOutput([{ "got melt quote": quote }]);
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
      const { isPaid, change } = await wallet.meltTokens(quote, proofs, {
        keysetId: wallet.keys.id,
      });

      if (isPaid) {
        waitingModal.style.display = 'none';
        showConfetti(quote.amount);
        //makeDeezNutsRain(quote.amount);
        const message = quote.amount + ' sat(s) sent to ' + lightningAddress;
        showToast(message);
        removeProofs(proofs, url);

        var changeArray = { "change": change };
        storeJSON(changeArray);

        addProofs(change, url);
      }
    } catch (error) {
      console.error(error);
      showToast(error);
      setDataOutput({ error: "Failed to zap deez nuts", details: error });
    }
  } // End zapDeezNuts

  async function payToPubkey(pubkey) {
    let { amount, message } = await showSendNutsModal();
    closeSendNutsModal();

    const storedMintData = JSON.parse(localStorage.getItem("activeMint"));
    const { url, keyset } = storedMintData;

    const proofs = getProofsByAmount(amount, url);
    if (proofs.length === 0) {
      showToast("Insufficient balance");
      return;
    }

    // Check if the secret key already exists in local storage
    let storedSecretKey = localStorage.getItem('secretKey');
    let secretKey;  // `secretKey` should be a Uint8Array

    if (storedSecretKey) {
      // If it exists, retrieve it from local storage and convert it back to Uint8Array
      secretKey = new Uint8Array(JSON.parse(storedSecretKey));
    } else {
      // If it doesn't exist, generate a new secret key
      secretKey = generateSecretKey();
      // Save the secret key to local storage as a JSON string
      localStorage.setItem('secretKey', JSON.stringify(Array.from(secretKey)));
    }

    let bullishNutsHex = 'c7617e02242f5853fe5b513d411f19b44ad3f0da95a28d33a9b7e927f255dd2d';
    //let bullishHex = 'a10260a2aa2f092d85e2c0b82e95eac5f8c60ea19c68e4898719b58ccaa23e3e'
    let publicKey = getPublicKey(secretKey) // `publicKey` is a hex string

    const relay = await Relay.connect('wss://relay.0xchat.com')
    console.log(`connected to ${relay.url}`)

    relay.subscribe([
      {
        kinds: [4],
        authors: [publicKey],
      },
    ], {
      onevent(event) {
        console.log('got event:', event)
      }
    })

    let sharedPoint = secp.getSharedSecret(secretKey, '02' + bullishNutsHex)
    let sharedX = sharedPoint.slice(1, 33)

    let iv = crypto.randomFillSync(new Uint8Array(16))
    var cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(sharedX),
      iv
    )

    const tempMint = new CashuMint(url);

    try {
      const info = await tempMint.getInfo();
      const { keysets } = await tempMint.getKeys();
      const satKeyset = keysets.find((k) => k.unit === "sat");
      let tempWallet = new CashuWallet(url, { keys: satKeyset, unit: "sat" });
      const { send, returnChange } = await tempWallet.send(amount, proofs);
      const encodedToken = getEncodedToken({
        token: [{ proofs: send, mint: url }], memo: "BULLISH"
      });

      sendEncryptedMessage(message);

      let encryptedMessage = cipher.update(`${encodedToken}`, 'utf8', 'base64')
      encryptedMessage += cipher.final('base64')
      let ivBase64 = Buffer.from(iv.buffer).toString('base64')

      let event = {
        pubkey: [publicKey],
        created_at: Math.floor(Date.now() / 1000),
        kind: 4,
        tags: [['p', bullishNutsHex]],
        content: encryptedMessage + '?iv=' + ivBase64
      }

      // this assigns the pubkey, calculates the event id and signs the event in a single step
      const signedEvent = finalizeEvent(event, secretKey)
      await relay.publish(signedEvent)

      removeProofs(proofs, url);
      showToast("Succesfully sent nuts! Thank you!");
      showConfetti(amount);
    } catch (error) {
      console.error(error);
      setDataOutput({ error: true, details: error });
    }
  }

  async function sendEncryptedMessage(message) {
    // Check if the secret key already exists in local storage
    let storedSecretKey = localStorage.getItem('secretKey');
    let secretKey;  // `secretKey` should be a Uint8Array

    if (storedSecretKey) {
      // If it exists, retrieve it from local storage and convert it back to Uint8Array
      secretKey = new Uint8Array(JSON.parse(storedSecretKey));
    } else {
      // If it doesn't exist, generate a new secret key
      secretKey = generateSecretKey();
      // Save the secret key to local storage as a JSON string
      localStorage.setItem('secretKey', JSON.stringify(Array.from(secretKey)));
    }

    let bullishNutsHex = 'c7617e02242f5853fe5b513d411f19b44ad3f0da95a28d33a9b7e927f255dd2d';
    let publicKey = getPublicKey(secretKey) // `publicKey` is a hex string

    let sharedPoint = secp.getSharedSecret(secretKey, '02' + bullishNutsHex)
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
      tags: [['p', bullishNutsHex]],
      content: encryptedMessage + '?iv=' + ivBase64
    }

    // this assigns the pubkey, calculates the event id and signs the event in a single step
    const signedEvent = finalizeEvent(event, secretKey)

    const relay = await Relay.connect('wss://relay.0xchat.com')
    console.log(`connected to ${relay.url}`)
    relay.publish(signedEvent)
  } // End sendEncryptedMessage()

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
        document.getElementById('cashu_token').value = text;
      })
      .catch(err => {
        console.error('Failed to read clipboard contents: ', err);
      });
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
    let encodedToken;

    try {
      encodedToken = getEncodedTokenV4(tokenData);
    }
    catch (error) {
      showToast("Unable to generate V4 token. Falling back to V3.");
      console.log(error);
      encodedToken = getEncodedToken(tokenData);

      // Set the toggle button to indicate V3 is active
      const toggleButton = document.getElementById('toggle_token_button');
      toggleButton.setAttribute('data-version', 'V3'); // Update the data attribute to V3
      toggleButton.innerText = 'V4'; // Update button text
    }

    document.getElementById('send_cashu_token').value = encodedToken;

    // Store the current token data in the hidden input
    document.getElementById('current_token_data').value = JSON.stringify(tokenData);

    // Get the div that will contain the QR code
    const qrCodeDiv = document.getElementById('cashu_token_qrcode');

    await generateQR(qrCodeDiv, encodedToken);

    const modal = document.getElementById('cashu_token_modal');
    modal.style.display = 'block';
  }

  // Function to handle toggling between V3 and V4 token formats
  async function handleToggleToken() {
    // Retrieve the token data from the hidden input
    const tokenData = JSON.parse(document.getElementById('current_token_data').value);

    if (!tokenData) {
      console.error("Token data is undefined");
      return; // Exit if tokenData is not set
    }

    const toggleButton = document.getElementById('toggle_token_button');
    const currentVersion = toggleButton.getAttribute('data-version'); // Get the current version from the data attribute

    try {
      let encodedToken;

      if (currentVersion === 'V4') {
        encodedToken = getEncodedToken(tokenData); // Get the V3 token
        toggleButton.setAttribute('data-version', 'V3'); // Update the data attribute to V3
        toggleButton.innerText = 'V4'; // Update button text
      } else {
        encodedToken = getEncodedTokenV4(tokenData); // Get the V4 token
        toggleButton.setAttribute('data-version', 'V4'); // Update the data attribute to V4
        toggleButton.innerText = 'V3'; // Update button text
      }

      // Display the token in the textarea
      document.getElementById('send_cashu_token').value = encodedToken;

      const qrCodeDiv = document.getElementById('cashu_token_qrcode');
      await generateQR(qrCodeDiv, encodedToken); // Generate the QR code
    } catch (error) {
      showToast("Unable to toggle the token format.");
      console.log(error);
    }
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

  function showSendNutsModal() {
    return new Promise((resolve) => {
      const modal = document.getElementById('send_nuts_modal');
      const amount = document.getElementById('send_nuts_amount');
      const message = document.getElementById('send_nuts_message');
      const submitButton = document.getElementById('send_nuts_submit');

      modal.style.display = 'block';

      submitButton.onclick = () => {
        const value = amount.value;
        const msg = message.value;
        resolve({ amount: value, message: msg }); // Resolve with an object
      };
    });
  }

  function closeSendNutsModal() {
    // Hide modal
    const modal = document.getElementById('send_nuts_modal');
    modal.style.display = 'none';

    // Clear inputs
    document.getElementById('send_nuts_amount').value = '';
    document.getElementById('send_nuts_message').value = '';
  }

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

  function showReceiveEcashModal() {
    const modal = document.getElementById('receive_ecash_modal');
    modal.style.display = 'block';
  }

  function closeReceiveEcashModal() {
    const modal = document.getElementById('receive_ecash_modal');
    document.getElementById('cashu_token').value = '';
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

  //Gets the npub for the selected contact, appends "@npub.cash", and copies it to the clipboard
  const handleContactSelect = (contact) => {
    const contactAddress = `${contact.npub}@npub.cash`;
    navigator.clipboard.writeText(contactAddress).then(() => {
      showToast(`Copied to clipboard: ${contactAddress}`);
    }).catch(err => {
      showToast(`Failed to copy: ${err}`);
    });
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

  let emojiInterval;

  function makeDeezNutsRain(amount) {
    const emojiContainer = document.createElement('div');
    emojiContainer.id = 'emoji-container';
    document.body.appendChild(emojiContainer);

    for (let i = 0; i < amount; i++) {
      const emoji = document.createElement('div');
      emoji.className = 'emoji';
      emoji.textContent = Math.random() > 0.5 ? '🥜' : '⚡';
      emoji.style.left = `${Math.random() * 100}vw`;
      emoji.style.animationDuration = `${Math.random() * 3 + 2}s`;
      emoji.style.fontSize = `${Math.random() * 2 + 1}rem`; // Random size between 1rem and 3rem
      emojiContainer.appendChild(emoji);

      // Remove emoji after animation ends
      emoji.addEventListener('animationend', () => {
        emoji.remove();
      });
    }
  }

  function showConfetti(confettiNumber = 21) {
    if (jsConfettiRef.current) {
      jsConfettiRef.current.addConfetti({
        emojis: ['🐂', '🥜', '⚡️'],
        emojiSize: 100,
        confettiNumber: confettiNumber,
      });
    }
  }

  async function checkProofs() {
    const storedMintData = JSON.parse(localStorage.getItem("activeMint"));
    const proofs = getAllProofs(storedMintData.url);
    if (proofs.length === 0) {
      showToast("No proofs to check");
      return;
    }
    const spentProofs = await wallet.checkProofsSpent(proofs);
    if (spentProofs.length > 0) {
      removeProofs(spentProofs, storedMintData.url);
    }
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

  return (
    <main>

      <div id="emoji-container"></div>

      <div className="cashu-operations-container">

        <div className="app_header">
          <h2><b><button onClick={() => showConfetti()}>bullishNuts</button></b><small style={{ marginLeft: '3px', marginTop: '1px' }}>v0.2.16</small></h2>
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
          <p>{balance} sats</p>
          <div className="button-container">
            <button className="styled-button" onClick={() => openEcashOrLightningModal('Send')}>Send<SendIcon style={{ height: '21px', width: '21px', marginLeft: '5px' }} /></button>
            <button className="styled-button" onClick={() => openEcashOrLightningModal('Receive')}>Receive<ReceiveIcon style={{ height: '21px', width: '21px', marginLeft: '5px' }} /></button>
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
            <button id="copy_token_button" className="styled-button" onClick={copyCashuToken}>Copy</button>
            <button id="toggle_token_button" className="styled-button" data-version="V4" onClick={handleToggleToken}>V3</button>
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

        {/* Send Nuts modal */}
        <div id="send_nuts_modal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeSendNutsModal}>&times;</span>
            <h2>Send Nuts</h2>
            <label htmlFor="send_nuts_amount">Amount</label>
            <input type="number" id="send_nuts_amount" inputMode="decimal" min="1" placeholder="Enter amount of sats" />
            <label htmlFor="send_nuts_message">Message</label>
            <textarea id="send_nuts_message" placeholder="Optional"></textarea>
            <button className="styled-button" id="send_nuts_submit">OK</button>
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
              <button className="orange-button" onClick={pasteFromClipboard} >Paste</button> Cashu token
            </label>
            <textarea id="cashu_token"></textarea>
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
          <Contacts onContactSelect={handleContactSelect} updateContacts={updateContacts} />
        </div>

        <div className="section">
          <h2>Donate</h2>
          <div className="button-container">
            <button className="styled-button" onClick={zapDeezNuts} >ZAP DEEZ NUTS<LightningIcon style={{ height: '21px', width: '21px', marginLeft: '3px' }} /></button>
          </div>
          <div className="button-container">
            <button className="styled-button" onClick={payToPubkey} >SEND NUTS 🥜</button>
          </div>
        </div>

        <div className="data-display-container">
          <h2>Advanced</h2>
          <p>Data Output</p>
          <pre id="data-output" className="data-output">{JSON.stringify(dataOutput, null, 2)}</pre>
          <div className="button-container">
            <button className="styled-button" onClick={checkProofs}>Check Proofs<CheckIcon style={{ height: '21px', width: '21px', marginLeft: '3px', marginBottom: '3px' }} /></button>
          </div>
          <div className="button-container">
            <button className="styled-button" onClick={exportJSON}>Export JSON Logs<ExportIcon style={{ height: '21px', width: '21px', marginLeft: '3px', marginBottom: '3px' }} /></button>
          </div>

        </div>

        <br></br>

        <div className="section">
          <small>Made with 🐂 by <a href="https://primal.net/thebullishbitcoiner">thebullishbitcoiner</a></small>
        </div>

      </div>

    </main>
  );

};

export default Wallet;
