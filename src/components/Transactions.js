import React, { useEffect, useState } from 'react';
import { TrashIcon, SendIcon, ReceiveIcon } from "@bitcoin-design/bitcoin-icons-react/filled";

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

function formatTimestamp(timestamp) {
    // Create a Date object from the timestamp
    const date = new Date(timestamp.replace(' ', 'T')); // Replace space with 'T' for proper parsing

    // Define arrays for month names
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Extract date components
    const year = date.getFullYear();
    const month = monthNames[date.getMonth()]; // Get month name
    const day = date.getDate();
    let hour = date.getHours();
    const minute = date.getMinutes();

    // Determine AM/PM and convert to 12-hour format
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12; // Convert to 12-hour format
    hour = hour ? hour : 12; // The hour '0' should be '12'

    // Format minute to always have two digits
    const formattedMinute = minute < 10 ? '0' + minute : minute;

    // Construct the final formatted string
    return `${month} ${day}, ${year} @ ${hour}:${formattedMinute} ${ampm}`;
}

// Modal component to display transaction details
const Modal = ({ transaction, onClose }) => {
    const [copied, setCopied] = useState(false);

    if (!transaction) return null;

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1000); // Hide after 2 seconds
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
            });
    };

    return (
        <div className='transaction_modal'>
            <div className='modal-content'>
                <span className="close-button" onClick={onClose}>&times;</span>
                <h2>Transaction Details</h2>

                <p>Type</p>
                <input type="text" readOnly value={transaction.type} style={{ width: '100%', marginTop: '-11px' }} />

                <p>Action</p>
                <input type="text" readOnly value={transaction.action} style={{ width: '100%', marginTop: '-11px' }} />

                <p>Amount</p>
                <input type="text" readOnly value={`${transaction.amount} ${transaction.amount === 1 ? 'sat' : 'sats'}`} style={{ width: '100%', marginTop: '-11px' }} />

                <p>Created</p>
                <input type="text" readOnly value={formatTimestamp(transaction.created)} style={{ width: '100%', marginTop: '-11px' }} />

                {/* Conditionally render properties based on transaction type */}
                {transaction.type === "Ecash" && (
                    <>
                        <p>Mint</p>
                        <input type="text" readOnly value={transaction.mint} style={{ width: '100%', marginTop: '-11px' }} />

                        <p>Token</p>
                        <div style={{ position: 'relative', marginTop: '-11px' }}>
                            <textarea
                                readOnly
                                value={transaction.token}
                                rows={3}
                                style={{ width: '100%', resize: 'none', outline: 'none' }}
                                onClick={() => copyToClipboard(transaction.token)}
                            />
                            {copied && <span className="copied-message">Copied!</span>}
                        </div>
                    </>
                )}

                {transaction.type === "Lightning" && (
                    <>
                        <p>Mint:</p>
                        <input type="text" readOnly value={transaction.mint} style={{ width: '100%', marginTop: '-11px' }} />

                        <p>Fee:</p>
                        <input type="text" readOnly value={`${transaction.fee} ${transaction.fee === 1 ? 'sat' : 'sats'}`} style={{ width: '100%', marginTop: '-11px' }} />

                        <p>Invoice</p>
                        <div style={{ position: 'relative', marginTop: '-11px' }}>
                            <textarea
                                readOnly
                                value={transaction.invoice}
                                rows={3}
                                style={{ width: '100%', resize: 'none', outline: 'none' }}
                                onClick={() => copyToClipboard(transaction.invoice)}
                            />
                            {copied && <span className="copied-message">Copied!</span>}
                        </div>
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

    const clearTransactions = () => {
        const confirmDelete = window.confirm("Are you sure you want to delete all transactions?");
        if (confirmDelete) {
            localStorage.removeItem('transactions');
            updateTransactions();
        }
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
            <div className="box_header">
                <h2>Transactions</h2>
                <button onClick={clearTransactions}><TrashIcon style={{ height: "21px", width: "21px", marginBottom: "15px" }} /></button>
            </div>
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
                                    {transaction.action.toLowerCase() === "send" ? (
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

