import useMultiMintStorage from "@/hooks/useMultiMintStorage";
import { CashuMint, CashuWallet, getEncodedToken } from "@cashu/cashu-ts";
import React, { useState, useEffect } from "react";
import Contacts from "@/components/Contacts";
import LightningModal from '@/components/LightningModal';
import { getDecodedToken, encodeJsonToBase64 } from "@/hooks/CashuDecoder";
import Mints from "@/components/Mints";
import EcashOrLightning from "@/components/EcashOrLightning";

//Nostr
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import crypto from 'crypto'
import * as secp from '@noble/secp256k1'
import { Relay } from 'nostr-tools/relay'

const Wallet = () => {
  const [isLightningModalOpen, setIsLightningModalOpen] = useState(false);
  const [isEcashOrLightningOpen, setIsEcashOrLightningOpen] = useState(false);
  const [ecashOrLightningModalLabel, setEcashOrLightningModalLabel] = useState("");
  const [contacts, setContacts] = useState([]);

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
      showMessageWithGif("bullishNuts is an ecash wallet that's in its early beta phase. " +
        "Please use at your own risk with a small amount of sats at a time. " +
        "Your first mint will be automatically added once you redeem a token. " +
        "Send me a DM on Nostr if you need one. 🥜");
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
        addProofs(proofs);

        closeInvoiceModal();
        showToast(`${amount} sat(s) received`);

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
          showToast('Ecash received!');

          return;
        } catch (error) {
          console.error(error);
          setDataOutput({ error: "Failed to receive token from a different mint.", details: error });
        }
      }

      const proofs = await currentWallet.receive(token);
      addProofs(proofs, mintURL);

      closeReceiveEcashModal();
      showToast('Ecash received!');

      setDataOutput(proofs);
      storeJSON(proofs);
    } catch (error) {
      console.error(error);
      closeReceiveEcashModal();
      showToast("Failed to claim token");
    }
  }

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

      const encodedToken = getEncodedToken({
        token: [{ proofs: send, mint: wallet.mint.mintUrl }],
      });

      //Close the sats input modal and display the cashu token modal
      closeSendEcashModal();
      showCashuTokenModal(encodedToken);

      //Add token to local storage
      storeJSON(encodedToken);

      removeProofs(proofs, wallet.mint.mintUrl);
      addProofs(returnChange, wallet.mint.mintUrl);
      setDataOutput(encodedToken);
      storeJSON(encodedToken);
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

        const quote = await wallet.createMeltQuote(invoice);

        setDataOutput([{ "got melt quote": quote }]);
        storeJSON(quote);

        const amount = quote.amount + quote.fee_reserve;
        const proofs = getProofsByAmount(amount, wallet.keys.id);
        if (proofs.length === 0) {
          showToast("Insufficient balance");
          return;
        }
        const { isPaid, change } = await wallet.meltTokens(quote, proofs, {
          keysetId: wallet.keys.id,
        });
        if (isPaid) {
          closeSendLightningModal();
          showToast('Invoice paid!');
          removeProofs(proofs);

          var changeArray = { "change": change };
          storeJSON(changeArray);

          addProofs(change);
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

  //This function checks to see if the Lightning address provided is valid, gets the amount of sats to send, and fetches invoice using the callback URL
  async function handleSend_LightningAddress_GetCallback(input) {
    try {
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
      const proofs = getProofsByAmount(amount, wallet.keys.id);
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
        const message = quote.amount + ' sat(s) sent to ' + input;
        showToast(message);
        removeProofs(proofs);

        var changeArray = { "change": change };
        storeJSON(changeArray);

        addProofs(change);
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
        makeDeezNutsRain(quote.amount);
        const message = quote.amount + ' sat(s) sent to ' + lightningAddress;
        showToast(message);
        removeProofs(proofs, url);

        var changeArray = { "change": change };
        storeJSON(changeArray);

        addProofs(change, url);
      }
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to melt tokens", details: error });
    }
  }

  async function payToPubkey(pubkey) {
    let amount = await showNumericInputModal();
    closeNumericInputModal();

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
        token: [{ proofs: send, mint: url }],
      });

      sendEncryptedMessage("Have some nuts!");

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
      showToast("Succesfully sent nuts!");
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

  async function fetchInvoiceFromCallback(callbackURL, amount) {
    const url = new URL(callbackURL);
    const params = {
      amount: amount,
    };
    url.search = new URLSearchParams(params).toString();

    try {
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.pr;
    } catch (error) {
      console.error('Error fetching JSON:', error);
      showToast('Error occurred while fetching invoice.');
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

  function showCashuTokenModal(token) {
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

  function closeSendLightningModal() {
    const modal = document.getElementById('send_lightning_modal');
    document.getElementById('send_lightning_input').value = '';
    modal.style.display = 'none';
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

  function showNumericInputModal() {
    return new Promise((resolve) => {
      const modal = document.getElementById('numeric_input_modal');
      const input = document.getElementById('numeric_input_amount');
      const submitButton = document.getElementById('numeric_input_submit');

      modal.style.display = 'block';

      submitButton.onclick = () => {
        const value = input.value;
        resolve(value);
      };
    });
  }

  function closeNumericInputModal() {
    const modal = document.getElementById('numeric_input_modal');
    document.getElementById('numeric_input_amount').value = '';
    modal.style.display = 'none';
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

  function showToast(message, duration = 4000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show';

    setTimeout(() => {
      toast.className = 'toast';
    }, duration);
  }

  function showMessageModal(message) {
    const modal = document.getElementById('message_modal');
    document.getElementById('message').textContent = message;
    modal.style.display = 'block';
  }

  function showMessageWithGif(text) {
    const messageElement = document.getElementById('message');
    messageElement.textContent = ''; // Clear any existing text

    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        messageElement.textContent += text[index];
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

  function getTimestamp_EST() {
    const date = new Date();
    const options = {
      timeZone: 'America/New_York',
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
    const timestamp = getTimestamp_EST();

    new Date().toLocaleTimeString

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
    const timestamp = getTimestamp_EST();
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

  function startEmojiRain() {
    const emojiContainer = document.createElement('div');
    emojiContainer.id = 'emoji-container';
    document.body.appendChild(emojiContainer);

    emojiInterval = setInterval(() => {
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
    }, 21);

    // Stop emoji rain after a few seconds
    setTimeout(stopEmojiRain, 1000);
  }

  function stopEmojiRain() {
    clearInterval(emojiInterval);

    // Remove the emoji container after a while to ensure all animations are done
    setTimeout(() => {
      document.getElementById('emoji-container').remove();
    }, 3000); // Extended to allow all emojis to fall
  }

  async function checkProofs() {
    const proofs = getAllProofs();
    if (proofs.length === 0) {
      showToast("No proofs to check");
      return;
    }
    const spentProofs = await wallet.checkProofsSpent(proofs);
    if (spentProofs.length > 0) {
      removeProofs(spentProofs);
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

  return (
    <main>

      <div id="emoji-container"></div>

      <div className="cashu-operations-container">

        <div id="refresh-icon" onClick={refreshPage}>⟳</div>
        <div id="toast" className="toast">This is a toast message.</div>

        {/* Message modal */}
        <div id="message_modal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeMessageModal}>&times;</span>
            <p id="message"></p>
            <button className="styled-button" onClick={closeMessageModal}>LFG</button>
          </div>
        </div>

        {/* Invoice modal */}
        <div id="invoiceModal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeInvoiceModal}>&times;</span>
            <p>Invoice:</p>
            <textarea id="invoiceText" readOnly></textarea>
            <button id="copyButton" className="styled-button" onClick={copyToClipboard}>Copy</button>
          </div>
        </div>

        <h6>bullishNuts <small>v0.0.74</small></h6>
        <br></br>

        <div className="section">
          <h2>Balance</h2>
          <p>{balance} sats</p>
          <div className="button-container">
            <button className="styled-button" onClick={() => openEcashOrLightningModal('Send')}>Send</button>
            <button className="styled-button" onClick={() => openEcashOrLightningModal('Receive')}>Receive</button>
          </div>
          <EcashOrLightning
            isOpen={isEcashOrLightningOpen}
            onClose={closeEcashOrLightningModal}
            onOptionSelect={handleOptionSelect}
            label={ecashOrLightningModalLabel}
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
            <span className="close-button" onClick={closeCashuTokenModal}>&times;</span>
            <p>Cashu token:</p>
            <textarea id="send_cashu_token" readOnly></textarea>
            <button id="copy_token_button" className="styled-button" onClick={copyCashuToken}>Copy</button>
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

        {/* Numeric input modal */}
        <div id="numeric_input_modal" className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={closeNumericInputModal}>&times;</span>
            <label htmlFor="numeric_input_amount">Enter amount:</label>
            <input type="number" id="numeric_input_amount" inputMode="decimal" min="1" />
            <button className="styled-button" id="numeric_input_submit">OK</button>
          </div>
        </div>

        {/* Waiting modal */}
        <div className="modal" id="waiting_modal">
          <div className="modal-content">
            <div className="spinner"></div>
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
            <label htmlFor="receive_lightning_amount">Enter amount of sats:</label>
            <input type="number" id="receive_lightning_amount" inputMode="decimal" min="1" />
            <button className="styled-button" onClick={createInvoiceButtonClicked}>Create invoice</button>
          </div>
        </div>

        {/* <div className="section">
          <h2>Mint</h2>
          <a href="https://bitcoinmints.com/">View list of available mints</a>
          <input
            type="text"
            name="mintUrl"
            value={formData.mintUrl}
            onChange={handleChange}
          />
          <button className="styled-button" onClick={handleSetMint}>
            Set Mint
          </button>
        </div> */}

        <div className="section">
          <Contacts onContactSelect={handleContactSelect} updateContacts={updateContacts} />
        </div>

        <div className="section">
          <h2>Zap Deez Nuts</h2>
          <div className="button-container">
            <button className="styled-button" onClick={zapDeezNuts} >SMASH DONATE ⚡</button>
          </div>
          <div className="button-container">
            <button className="styled-button" onClick={payToPubkey} >SEND NUTS 🥜</button>
          </div>
        </div>

        <div className="data-display-container">
          <h2>Advanced</h2>
          <p>Data Output</p>
          <pre id="data-output" className="data-output">{JSON.stringify(dataOutput, null, 2)}</pre>
          <button className="full_width_button" onClick={checkProofs}>Check Proofs</button>
          <button className="full_width_button" onClick={exportJSON}>Export JSON Logs</button>
        </div>

        <br></br>

        <div className="section">
          <small>Made with <button onClick={startEmojiRain}>🐂</button> by <a href="https://thebullishbitcoiner.com/">thebullishbitcoiner</a></small>
        </div>

      </div>

    </main>
  );

};

export default Wallet;
