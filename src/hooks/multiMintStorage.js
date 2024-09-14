import { useState, useEffect } from "react";

export const multiMintStorage = () => {
    const [proofsByMint, setProofsByMint] = useState([]); // Initialize as an empty array.
    const [balance, setBalance] = useState(0);
    const [activeMint, setActiveMint] = useState(null);

    useEffect(() => {
        // Fetch stored proofsByMint from localStorage
        const storedProofsByMint = localStorage.getItem("proofsByMint");
        if (storedProofsByMint) {
            const parsedProofsByMint = JSON.parse(storedProofsByMint);
            console.log("Parsed proofsByMint:", parsedProofsByMint); // Debugging line
            setProofsByMint(parsedProofsByMint || []); // Ensure it's an array
        } else {
            console.log("No stored proofsByMint found."); // Debugging line
        }

        const storedActiveMint = localStorage.getItem("activeMint");
        if (storedActiveMint) {
            setActiveMint(storedActiveMint);
        } else {
            console.log("No stored activeMint found."); // Debugging line
        }
    }, []); // This runs only once when the component mounts.

    useEffect(() => {
        // Ensure proofsByMint is a valid object and not empty
        if (typeof proofsByMint !== 'object' || proofsByMint === null || Object.keys(proofsByMint).length === 0) return;
    
        // Store updated proofsByMint in localStorage
        localStorage.setItem("proofsByMint", JSON.stringify(proofsByMint));
    
        // Calculate new balance from the updated proofsByMint
        const newBalance = calculateTotalBalance(proofsByMint);
        setBalance(newBalance);
    
    }, [proofsByMint]); // This runs every time proofsByMint is updated

    useEffect(() => {
        if (activeMint) {
            localStorage.setItem("activeMint", activeMint);
        }
    }, [activeMint]);

    const calculateTotalBalance = (proofs) => {
        return Object.values(proofs)
            .flat()
            .reduce((total, proof) => total + proof.amount, 0);
    };

    const calculateMintBalance = (mint) => {
        if (!proofsByMint[mint]) return 0;
        return proofsByMint[mint].reduce((total, proof) => total + proof.amount, 0);
    };

    const addProofs = (newProofs, mint) => {
        setProofsByMint((prevProofsByMint) => {
            const updatedProofs = { ...prevProofsByMint };
            if (!updatedProofs[mint]) {
                updatedProofs[mint] = [];
            }
            updatedProofs[mint] = [...updatedProofs[mint], ...newProofs];
            return updatedProofs;
        });
    };

    const removeProofs = (proofsToRemove, mint) => {
        if (!proofsToRemove || !mint) return;
        setProofsByMint((prevProofsByMint) => {
            const updatedProofs = { ...prevProofsByMint };
            updatedProofs[mint] = updatedProofs[mint].filter(
                (proof) => !proofsToRemove.includes(proof)
            );
            return updatedProofs;
        });
    };

    const getProofsByAmount = (amount, mint, keysetId = undefined) => {
        const result = [];
        let sum = 0;

        if (!proofsByMint[mint]) return [];

        for (const proof of proofsByMint[mint]) {
            if (sum >= amount) break;
            if (keysetId && proof.id !== keysetId) continue;
            result.push(proof);
            sum += proof.amount;
        }

        return result.length > 0 && sum >= amount ? result : [];
    };

    const getAllProofs = (mint) => {
        return proofsByMint[mint] || [];
    };

    const getMintBalance = (mint) => {
        return calculateMintBalance(mint);
    };

    return {
        addProofs,
        removeProofs,
        getProofsByAmount,
        getAllProofs,
        getMintBalance,
        balance,
        activeMint,
        setActiveMint,
    };
};

export default multiMintStorage;
