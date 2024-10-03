import React, { useState, useEffect } from "react";
import useMultiMintStorage from "@/hooks/useMultiMintStorage";
import { CashuMint } from "@cashu/cashu-ts";

const Mints = ({ onMintChange, balance }) => {
    
    const { getMintBalance } = useMultiMintStorage();
    
    const [mintNames, setMintNames] = useState([]);
    const [activeMint, setLocalActiveMint] = useState(null); // Local state for activeMint
    const [showModal, setShowModal] = useState(false); // State for showing/hiding modal
    const [newMintURL, setNewMintURL] = useState(""); // State for holding new mint URL

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
        console.log("Balance changed:", balance);
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
            setShowModal(false);
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

    return (
        <div>
            <div className="header">
                <h2>Mints</h2>
                {/* Add mint button */}
                <button className="add-button" onClick={() => { setShowModal(true); }}>+</button>
            </div>
            <div className="mints-list">
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
                            <button className="delete-button" onClick={() => handleDeleteMint(mint.mintUrl)}>×</button>
                        </div>
                    ))
                ) : (
                    <p>No mints added. Add one from <a href="https://bitcoinmints.com/">bitcoinmints.com</a> or <a href="https://cashumints.space/">cashumints.space</a></p>
                )}
            </div>

            {/* Modal for adding new mints */}
            {showModal && (
                <div className="add_mint_modal">
                    <div className="modal-content">
                        <span className="close-button" onClick={() => setShowModal(false)}>&times;</span>
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

            {/* Toast Notification */}
            <div id="toast" className="toast"></div>
        </div>
    );
};

export default Mints;
