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

    useEffect(() => {
        const fetchMintNames = async () => {
            if (typeof window !== "undefined" && localStorage.getItem('proofsByMint')) {
                const storedProofsByMint = JSON.parse(localStorage.getItem('proofsByMint')) || {};
                const mintURLs = Object.keys(storedProofsByMint);

                const mintNamesPromises = mintURLs.map(async (mintUrl) => {
                    try {
                        const mint = new CashuMint(mintUrl);
                        const info = await mint.getInfo();
                        return { mintUrl, name: info.name || mintUrl }; // Fallback to URL if no name is provided
                    } catch (error) {
                        console.error(`Failed to fetch mint info for ${mintUrl}:`, error);
                        return { mintUrl, name: mintUrl }; // Fallback in case of an error
                    }
                });

                const mintNamesWithInfo = await Promise.all(mintNamesPromises);
                setMintNames(mintNamesWithInfo);
            }
        };

        fetchMintNames();

        // Get activeMint from localStorage
        const storedActiveMint = JSON.parse(localStorage.getItem("activeMint"));
        if (storedActiveMint) {
            const { url, keyset } = storedActiveMint;
            setLocalActiveMint(url); // Set it in the local state
        }
    }, []);

    const handleMintSelection = (mint) => {
        // Call the callback to inform index.js about the mint change
        onMintChange(mint);
        setLocalActiveMint(mint); // Update local state
    };

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