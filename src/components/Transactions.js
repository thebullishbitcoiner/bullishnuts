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

// Modal component to display transaction details
const Modal = ({ transaction, onClose }) => {
    if (!transaction) return null;

    return (
        <div className='transaction_modal'>
            <div className='modal-content'>
                <span className="close-button" onClick={onClose}>&times;</span>
                <h2>Transaction Details</h2>
                <p><strong>Type:</strong> {transaction.type}</p>
                <p><strong>Action:</strong> {transaction.action}</p>
                <p><strong>Amount:</strong> {transaction.amount} {transaction.amount === 1 ? 'sat' : 'sats'}</p>
                <p><strong>Created:</strong> {timeAgo(transaction.created)}</p>

                {/* Conditionally render properties based on transaction type */}
                {transaction.type === "Ecash" && (
                    <>
                        <p><strong>Mint:</strong> {transaction.mint}</p>
                        <p><strong>Token:</strong></p>
                        <textarea
                            readOnly
                            value={transaction.token}
                            rows={3}
                            style={{ width: '100%', resize: 'none' }}
                        />
                    </>
                )}
                {transaction.type === "Lightning" && (
                    <>
                        <p><strong>Mint:</strong> {transaction.mint}</p>
                        <p><strong>Fee:</strong> {transaction.fee} {transaction.fee === 1 ? 'sat' : 'sats'}</p>
                        <p><strong>Invoice:</strong></p>
                        <textarea
                            readOnly
                            value={transaction.invoice}
                            rows={3}
                            style={{ width: '100%', resize: 'none' }}
                        />
                    </>
                )}
            </div>
        </div>
    );
};


const Transactions = ({ updateFlag_Transactions }) => {
    const [transactions, setTransactions] = useState([]);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

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

    const handleTransactionClick = (transaction) => {
        setSelectedTransaction(transaction);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedTransaction(null);
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
                                onClick={() => handleTransactionClick(transaction)}
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
            {/* Modal for displaying transaction details */}
            {isModalOpen && (
                <Modal transaction={selectedTransaction} onClose={closeModal} />
            )}
        </div>
    );
};

export default Transactions;

