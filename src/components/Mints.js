import React, { useState, useEffect } from "react";
import useMultiMintStorage from "@/hooks/useMultiMintStorage";
import { CashuMint } from "@cashu/cashu-ts";
import { PlusIcon, CrossIcon } from '@bitcoin-design/bitcoin-icons-react/filled'
import { InfoCircleIcon } from '@bitcoin-design/bitcoin-icons-react/outline'

const MintInfoModal = ({ mintInfo, onClose }) => {

    if (!mintInfo) return null;

    // Format the contact information into a string
    const formattedContactInfo = mintInfo.contact.map(contact => {
        return `${contact.method}: ${contact.info}`;
    }).join('\n'); // Join with newline for better readability

    return (
        <div className="mint-info-modal">
            <div className="modal-content">
                <span className="close-button" onClick={onClose}>&times;</span>
                <h2>{mintInfo.name}</h2>

                <p style={{ marginTop: '5px', marginBottom: '0px' }}>Description</p>
                <textarea readOnly value={mintInfo.description} style={{ width: '100%', height: '100px', marginBottom: '0px', resize: 'none' }} />

                <p style={{ marginTop: '5px', marginBottom: '0px' }}>Public Key</p>
                <textarea readOnly value={mintInfo.pubkey} style={{ width: '100%', height: '90px', marginBottom: '0px', resize: 'none' }} />

                <p style={{ marginTop: '5px', marginBottom: '0px' }}>Version</p>
                <input type="text" readOnly value={mintInfo.version} style={{ width: '100%', marginBottom: '5px' }} />

                <p style={{ marginTop: '5px', marginBottom: '0px' }}>Message of the day</p>
                <textarea readOnly value={mintInfo.motd} style={{ width: '100%', height: '42px', marginBottom: '0px', resize: 'none' }} />

                <p style={{ marginTop: '5px', marginBottom: '0px' }}>Contact</p>
                <textarea
                    readOnly
                    value={formattedContactInfo}
                    style={{ width: '100%', height: '100px', resize: 'none' }} // Optional styling
                />
                {/* Add more fields as necessary */}
            </div>
        </div>
    );
};

const Mints = ({ onMintChange, balance }) => {

    const { getMintBalance } = useMultiMintStorage();
    const [mintNames, setMintNames] = useState([]);
    const [activeMint, setLocalActiveMint] = useState(null); // Local state for activeMint
    const [showInfoModal, setShowInfoModal] = useState(false); // State for showing/hiding modal
    const [newMintURL, setNewMintURL] = useState(""); // State for holding new mint URL
    const [selectedMintInfo, setSelectedMintInfo] = useState(null);

    useEffect(() => {
        // Prevent scrolling when the modal is open
        if (showInfoModal || selectedMintInfo) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }

        // Cleanup function to reset overflow when the component unmounts
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [showInfoModal, selectedMintInfo]);

    // Fetch mint names and set activeMint if not already set
    const fetchMintNames = async () => {
        if (typeof window !== "undefined" && localStorage.getItem("proofsByMint")) {
            const storedProofsByMint = JSON.parse(localStorage.getItem("proofsByMint")) || {};
            const mintURLs = Object.keys(storedProofsByMint);

            // Retrieve the activeMint from localStorage, if any
            const storedActiveMint = JSON.parse(localStorage.getItem("activeMint"));
            let localActiveMint = storedActiveMint ? storedActiveMint.url : null;

            const mintNamesPromises = mintURLs.map(async (mintUrl) => {
                try {
                    const storedMintInfo = JSON.parse(localStorage.getItem("mintInfo")) || {};

                    // If the mint info for this URL is not in localStorage, fetch and store it
                    if (!storedMintInfo[mintUrl]) {
                        const mint = new CashuMint(mintUrl);
                        const info = await mint.getInfo();

                        // Store the fetched mint info in localStorage
                        storedMintInfo[mintUrl] = info;
                        localStorage.setItem("mintInfo", JSON.stringify(storedMintInfo));
                    }

                    // Use the info from localStorage
                    const mintInfo = storedMintInfo[mintUrl];
                    return { mintUrl, name: mintInfo.name || mintUrl }; // Fallback to URL if no name is provided
                } catch (error) {
                    console.error(`Failed to fetch mint info for ${mintUrl}:`, error);
                    return { mintUrl, name: mintUrl }; // Fallback in case of an error
                }
            });

            const mintNamesWithInfo = await Promise.all(mintNamesPromises);
            setMintNames(mintNamesWithInfo);

            // Set the first mint as active if there's no active mint set yet in localStorage
            if (mintNamesWithInfo.length > 0 && !localActiveMint) {
                const firstMint = mintNamesWithInfo[0].mintUrl;
                setLocalActiveMint(firstMint);
                onMintChange(firstMint);
                localStorage.setItem("activeMint", JSON.stringify({ url: firstMint }));
            }
        }
    };

    // Fetch mint names and activeMint on mount
    useEffect(() => {
        fetchMintNames();

        // Get activeMint from localStorage
        const storedActiveMint = JSON.parse(localStorage.getItem("activeMint"));
        if (storedActiveMint) {
            setLocalActiveMint(storedActiveMint.url); // Set it in the local state
        }

        // Add a storage event listener to detect changes to proofsByMint in localStorage
        const handleStorageChange = (e) => {
            if (e.key === "proofsByMint") {
                fetchMintNames(); // Re-fetch mint names when proofsByMint is modified
            }
        };

        window.addEventListener("storage", handleStorageChange);

        return () => {
            // To avoid memory leaks, clean up the event listener when the component unmounts
            window.removeEventListener("storage", handleStorageChange);
        };
    }, []); // Empty array ensures it only runs once on mount

    // Effect to re-fetch mint names and balances when the balance changes
    useEffect(() => {
        fetchMintNames(); // Re-fetch mint names and balances when balance changes
    }, [balance]);

    const handleMintSelection = (mint) => {
        onMintChange(mint);
        setLocalActiveMint(mint); // Update local state
    };

    const handleDeleteMint = (mintUrl) => {
        if (mintUrl === activeMint) {
            showToast("Cannot delete the active mint.");
            return;
        }

        const mintBalance = getMintBalance(mintUrl);
        if (mintBalance > 0) {
            showToast("Cannot delete mint with a non-zero balance.");
            return;
        }

        // Delete from proofsByMint and mintInfo
        const storedProofsByMint = JSON.parse(localStorage.getItem("proofsByMint")) || {};
        const storedMintInfo = JSON.parse(localStorage.getItem("mintInfo")) || {};

        delete storedProofsByMint[mintUrl]; // Remove the mint from proofsByMint
        delete storedMintInfo[mintUrl];     // Remove the mint from mintInfo

        // Update localStorage
        localStorage.setItem("proofsByMint", JSON.stringify(storedProofsByMint));
        localStorage.setItem("mintInfo", JSON.stringify(storedMintInfo));

        // Remove the mint from the displayed list
        setMintNames((prev) => prev.filter((mint) => mint.mintUrl !== mintUrl));

        showToast("Mint deleted successfully.");
    };

    const handleAddMint = async () => {
        if (!newMintURL || !newMintURL.startsWith("https://")) {
            showToast("Please enter a valid mint URL.");
            return;
        }

        try {
            // Update proofsByMint and mintInfo in localStorage
            const storedProofsByMint = JSON.parse(localStorage.getItem("proofsByMint")) || {};
            const storedMintInfo = JSON.parse(localStorage.getItem("mintInfo")) || {};

            // Add new mint entry with empty proofs array
            storedProofsByMint[newMintURL] = [];

            // Get mint info 
            const mint = new CashuMint(newMintURL);
            const info = await mint.getInfo();

            // Add fetched mint info to mintInfo
            storedMintInfo[newMintURL] = info;

            // Save the updated data to localStorage
            localStorage.setItem("proofsByMint", JSON.stringify(storedProofsByMint));
            localStorage.setItem("mintInfo", JSON.stringify(storedMintInfo));

            // Re-fetch mint names and hide the modal
            await fetchMintNames(); // Ensure state updates after data is stored
            setShowInfoModal(false);
            setNewMintURL("");
            showToast("Mint added successfully.");
        } catch (error) {
            console.error("Failed to add mint:", error);
            showToast("Failed to add mint. Please check the URL and try again.");
        }
    };

    function showToast(message, duration = 4000) {
        const toast = document.getElementById("toast");
        toast.textContent = message;
        toast.className = "toast show";

        setTimeout(() => {
            toast.className = "toast";
        }, duration);
    }

    const showMintInfo = async (mintUrl) => {
        const storedMintInfo = JSON.parse(localStorage.getItem("mintInfo")) || {};
        const mintInfo = storedMintInfo[mintUrl];
        setSelectedMintInfo(mintInfo);
    };

    const closeMintInfoModal = () => {
        setSelectedMintInfo(null);
    };

    return (
        <div>
            <div className="box_header">
                <h2 >Mints</h2>
                <button onClick={() => { setShowInfoModal(true); }}><PlusIcon style={{ height: "21px", width: "21px", marginBottom: "10px" }} /></button>
            </div>
            <div>
                {mintNames.length > 0 ? (
                    mintNames.map((mint, index) => (
                        <div key={index} className="mint-row">
                            <div className="mint-checkbox">
                                <input
                                    type="radio"
                                    name="activeMint"
                                    checked={mint.mintUrl === activeMint}
                                    onChange={() => handleMintSelection(mint.mintUrl)}
                                />
                            </div>
                            <div className="mint-info">
                                <div className="mint-name-row">
                                    <span className="mint-name">{mint.name}</span>
                                </div>
                                <div className="mint-balance-row">
                                    <span className="mint-balance">
                                        {getMintBalance(mint.mintUrl)}{" "}
                                        {getMintBalance(mint.mintUrl) === 1 ? "sat" : "sats"}
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => showMintInfo(mint.mintUrl)}>
                                <InfoCircleIcon style={{ height: "21px", width: "21px", marginRight: '5px' }} />
                            </button>
                            <button onClick={() => handleDeleteMint(mint.mintUrl)}>
                                <CrossIcon style={{ height: "21px", width: "21px" }} />
                            </button>
                        </div>
                    ))
                ) : (
                    <p>No mints added. Add one from <a href="https://bitcoinmints.com/">bitcoinmints.com</a> or <a href="https://cashumints.space/">cashumints.space</a></p>
                )}
            </div>

            {/* Modal for adding new mints */}
            {showInfoModal && (
                <div className="add_mint_modal">
                    <div className="modal-content">
                        <span className="close-button" onClick={() => setShowInfoModal(false)}>&times;</span>
                        <h2>Add Mint</h2>
                        <input
                            type="text"
                            placeholder="https://"
                            value={newMintURL}
                            onChange={(e) => setNewMintURL(e.target.value)}
                        />
                        <button className="styled-button" onClick={handleAddMint}>Submit</button>
                    </div>
                </div>
            )}

            {/* Mint Info Modal */}
            {selectedMintInfo && (
                <MintInfoModal mintInfo={selectedMintInfo} onClose={closeMintInfoModal} />
            )}

            {/* Toast Notification */}
            <div id="toast" className="toast"></div>
        </div>
    );
};

export default Mints;
