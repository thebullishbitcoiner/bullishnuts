import { useState, useEffect } from "react";

export const useProofStorage = () => {
  const [proofs, setProofs] = useState(null);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const storedProofs = localStorage.getItem("proofs");
    if (storedProofs) {
      const parsedProofs = JSON.parse(storedProofs);
      setProofs(parsedProofs);
      const initialBalance = parsedProofs.reduce(
        (total, proof) => total + proof.amount,
        0
      );
      setBalance(initialBalance);
    }
  }, []);

  useEffect(() => {
    if (!proofs) return;
    localStorage.setItem("proofs", JSON.stringify(proofs));
    const newBalance = proofs.reduce((total, proof) => total + proof.amount, 0);
    setBalance(newBalance);
  }, [proofs]);

  const addProofs = (newProofs) => {
    setProofs((prevProofs) => [...(prevProofs || []), ...newProofs]);
  };

  const removeProofs = (proofsToRemove) => {
    if (!proofsToRemove) return;
    setProofs((prevProofs) =>
      prevProofs.filter((proof) => !proofsToRemove.includes(proof))
    );
  };

  const getProofsByAmount = (amount, keysetId = undefined) => {
    const result = [];
    let sum = 0;

    for (const proof of proofs) {
      if (sum >= amount) break;
      if (keysetId && proof.id !== keysetId) continue;
      result.push(proof);
      sum += proof.amount;
    }

    return result.length > 0 && sum >= amount ? result : [];
  };

  const getAllProofs = () => {
    return proofs;
  }

  return {
    addProofs,
    removeProofs,
    getProofsByAmount,
    getAllProofs,
    balance,
  };
};

export default useProofStorage;