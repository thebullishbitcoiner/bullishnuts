import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { LightningIcon } from "@bitcoin-design/bitcoin-icons-react/filled";
import { TrashIcon } from "@bitcoin-design/bitcoin-icons-react/outline";

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

// Component to display transaction details
const DetailsModal = ({ transaction, onClose, isOpen }) => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1000); // Hide after 1 second
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
            });
    };

    const generateQR = async (text) => {
        const qrcodeDiv = document.getElementById('qrcode');

        // Remove any existing QR code
        qrcodeDiv.innerHTML = "";

        // Create a canvas element manually
        const canvas = document.createElement('canvas');

        qrcodeDiv.appendChild(canvas);

        // Add click event to the canvas to copy the appropriate text
        canvas.addEventListener('click', () => {
            const textToCopy = transaction.type === "Ecash" ? transaction.token : transaction.invoice;
            copyToClipboard(textToCopy);
        });

        try {
            // Generate QR code directly on the canvas
            await QRCode.toCanvas(canvas, text, {
                width: 268,  // Set a static width for testing
                color: {
                    dark: "#000000",  // Dots
                    light: "#FF9900"  // Background
                },
            });
        } catch (error) {
            console.error("Error generating QR code:", error);
        }
    };

    // Effect to generate QR code when the modal opens or transaction changes
    useEffect(() => {
        if (isOpen && transaction) {
            const textToEncode = transaction.type === "Ecash" ? transaction.token : transaction.invoice;
            generateQR(textToEncode);
        }
    }, [isOpen, transaction]); // Run effect when isOpen or transaction changes

    // If the modal is not open, return null
    if (!isOpen) return null;

    return (
        <div className='transaction_modal'>
            <div className='modal-content'>
                <span className="close-button" onClick={onClose}>&times;</span>
                <h2>Transaction Details</h2>

                <div id="qrcode" style={{ position: 'relative' }}>
                    {copied && (
                        <span className="copied-message" style={{
                            position: 'absolute',
                            top: '0px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: '5px',
                            paddingBottom: '21px',
                            zIndex: 10
                        }}>
                            Copied!
                        </span>
                    )}
                </div>

                <p style={{ marginTop: '5px', marginBottom: '0px' }}>Type</p>
                <input type="text" readOnly value={transaction.type} style={{ width: '100%', marginBottom: '5px' }} />

                <p style={{ marginBottom: '0px' }}>{transaction.action}</p>
                <input type="text" readOnly value={`${transaction.amount} ${transaction.amount === 1 ? 'sat' : 'sats'}`} style={{ width: '100%', marginBottom: '5px' }} />

                <p style={{ marginBottom: '0px' }}>Created</p>
                <input type="text" readOnly value={formatTimestamp(transaction.created)} style={{ width: '100%', marginBottom: '5px' }} />

                <p style={{ marginBottom: '0px' }}>Mint</p>
                <input type="text" readOnly value={transaction.mint} style={{ width: '100%', marginBottom: '5px' }} />

                {transaction.type === "Lightning" && (
                    <>
                        <p style={{ marginBottom: '0px' }}>Fee</p>
                        <input type="text" readOnly value={`${transaction.fee} ${transaction.fee === 1 ? 'sat' : 'sats'}`} style={{ width: '100%' }} />
                    </>
                )}
            </div>
        </div>
    );
};

const Transactions = ({ updateFlag_Transactions }) => {
    const [transactions, setTransactions] = useState([]);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    useEffect(() => {
        // Prevent scrolling when the modal is open
        if (showDetailsModal || selectedTransaction) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }

        // Cleanup function to reset overflow when the component unmounts
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [showDetailsModal, selectedTransaction]);

    const updateTransactions = () => {
        const storedTransactions = JSON.parse(localStorage.getItem("bullishnuts_transactions")) || [];
        setTransactions(storedTransactions);
    };

    const clearTransactions = () => {
        const confirmDelete = window.confirm("Are you sure you want to delete all transactions?");
        if (confirmDelete) {
            localStorage.removeItem('bullishnuts_transactions');
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
        setShowDetailsModal(true);
    };

    const closeModal = () => {
        setShowDetailsModal(false);
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
                <div style={{ maxHeight: '210px', overflowY: 'auto', border: '1px solid #ff9900', borderRadius: '0px', padding: '10px' }}>
                    <ul style={{ listStyleType: 'none', padding: 0 }}>
                        {transactions.map((transaction, index) => (
                            <li
                                key={index}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', cursor: 'pointer' }}
                                onClick={() => handleTransactionClick(transaction)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {transaction.type === "Ecash" ? (
                                        <img src="/images/cashu-orange.png" alt="Cashu icon" style={{ height: '30px', width: '30px', marginRight: '15px' }} />
                                    ) : (
                                        <LightningIcon style={{ height: '35px', width: '35px', marginRight: '12px', marginLeft: '-3px' }} />
                                    )}
                                    <div>
                                        <div style={{ marginTop: '2px' }}>{transaction.action}</div>
                                        <div style={{ fontSize: '0.8em', color: '#666', marginTop: '-3px' }}>{timeAgo(transaction.created)}</div> {/* Human-readable timestamp */}
                                    </div>
                                </div>
                                <div>
                                    {(() => {
                                        const action = transaction.action.toLowerCase();
                                        const sign = (action === "send" || action === "auto sweep" || action === "donate") ? "-" : "+";
                                        return `${sign}${transaction.amount} ${transaction.amount === 1 ? 'sat' : 'sats'}`;
                                    })()}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {/* Always render the DetailsModal, but control its visibility */}
            <DetailsModal transaction={selectedTransaction} onClose={closeModal} isOpen={showDetailsModal} />
        </div>
    );
};

export default Transactions;

