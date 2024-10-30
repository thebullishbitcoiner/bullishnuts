import React, { useEffect, useState } from 'react';
import { SendIcon, ReceiveIcon } from "@bitcoin-design/bitcoin-icons-react/filled";

// Function to convert timestamp to human-readable format
const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);

    if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;

    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? '' : 's'} ago`;
};

const Transactions = ({ updateFlag_Transactions }) => {
    const [transactions, setTransactions] = useState([]);

    const updateTransactions = () => {
        const storedTransactions = JSON.parse(localStorage.getItem("transactions")) || [];
        setTransactions(storedTransactions);
    };

    useEffect(() => {
        // Initial load of transactions
        updateTransactions();
    }, []);

    useEffect(() => {
        // Update transactions whenever updateFlag changes
        updateTransactions();
    }, [updateFlag_Transactions]);

    // Function to copy token to clipboard
    const copyToClipboard = (token) => {
        navigator.clipboard.writeText(token)
            .then(() => {
                alert(`Token copied to clipboard!`);
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
            });
    };

    return (
        <div>
            <h2>Transactions</h2>
            {/* Display message if no transactions */}
            {transactions.length === 0 ? (
                <p>No transactions yet.</p>
            ) : (
                <div style={{ maxHeight: '222px', overflowY: 'auto', border: '1px solid #ff9900', borderRadius: '0px', padding: '10px' }}>
                    <ul style={{ listStyleType: 'none', padding: 0 }}>
                        {transactions.map((transaction, index) => (
                            <li
                                key={index}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', cursor: 'pointer' }}
                                onClick={() => copyToClipboard(transaction.token)} // Copy token directly
                            >
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {transaction.action === "send" ? (
                                        <SendIcon style={{ height: '21px', width: '21px', marginRight: '10px' }} />
                                    ) : (
                                        <ReceiveIcon style={{ height: '21px', width: '21px', marginRight: '10px' }} />
                                    )}
                                    <div>
                                        <div style={{ marginTop: '2px' }}>{transaction.type}</div>
                                        <div style={{ fontSize: '0.8em', color: '#666', marginTop: '-3px' }}>{timeAgo(transaction.created)}</div> {/* Human-readable timestamp */}
                                    </div>
                                </div>
                                <div>{transaction.amount} {transaction.amount === 1 ? 'sat' : 'sats'}</div> {/* Append "sat" or "sats" */}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default Transactions;
