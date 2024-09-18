import React, { useState, useEffect } from "react";
import useMultiMintStorage from "@/hooks/useMultiMintStorage";
import { CashuMint } from "@cashu/cashu-ts";

const Mints = ({ onMintChange }) => {
    const {
        getMintBalance,
        balance,
    } = useMultiMintStorage();

    const [mintNames, setMintNames] = useState([]);
    const [activeMint, setLocalActiveMint] = useState(null); // Local state for activeMint

    const fetchMintNames = async () => {
        if (typeof window !== "undefined" && localStorage.getItem("proofsByMint")) {
            const storedProofsByMint = JSON.parse(localStorage.getItem("proofsByMint")) || {};
            const mintURLs = Object.keys(storedProofsByMint);

            const mintNamesPromises = mintURLs.map(async (mintUrl) => {
                try {
                    // Check if mint info is already in localStorage
                    const storedMintInfo = JSON.parse(localStorage.getItem('mintInfo')) || {};

                    // If the mint info for this URL is not in localStorage, fetch and store it
                    if (!storedMintInfo[mintUrl]) {
                        const mint = new CashuMint(mintUrl);
                        const info = await mint.getInfo();

                        // Store the fetched mint info in localStorage
                        storedMintInfo[mintUrl] = info;
                        localStorage.setItem('mintInfo', JSON.stringify(storedMintInfo));
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
        }
    };

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

    const handleMintSelection = (mint) => {
        // Call the callback to inform index.js about the mint change
        onMintChange(mint);
        setLocalActiveMint(mint); // Update local state
    };

    const handleDeleteMint = (mintUrl) => {
        const mintBalance = getMintBalance(mintUrl);

        // Check if the mint has a non-zero balance
        if (mintBalance > 0) {
            showToast("Cannot delete mint with a non-zero balance.");
            return;
        }

        // Delete from proofsByMint and mintInfo
        const storedProofsByMint = JSON.parse(localStorage.getItem('proofsByMint')) || {};
        const storedMintInfo = JSON.parse(localStorage.getItem('mintInfo')) || {};

        delete storedProofsByMint[mintUrl]; // Remove the mint from proofsByMint
        delete storedMintInfo[mintUrl];     // Remove the mint from mintInfo

        // Update localStorage
        localStorage.setItem('proofsByMint', JSON.stringify(storedProofsByMint));
        localStorage.setItem('mintInfo', JSON.stringify(storedMintInfo));

        // Remove the mint from the displayed list
        setMintNames((prev) => prev.filter((mint) => mint.mintUrl !== mintUrl));

        showToast("Mint deleted successfully.");
    };

    function showToast(message, duration = 4000) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast show';

        setTimeout(() => {
            toast.className = 'toast';
        }, duration);
    }

    return (
        <div>
            <h2>Mints</h2>
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
                    <p>No mints available</p>
                )}
            </div>
        </div>
    );
};

export default Mints;