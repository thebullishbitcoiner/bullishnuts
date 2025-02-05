import React, { useState } from 'react';

const SendNutsModal = ({ receiver = null, onClose, onSubmit, isOpen }) => {
    const [amount, setAmount] = useState('');
    const [message, setMessage] = useState('');

    // Set default receiver if none is provided
    const defaultReceiver = 'npub1cashuq3y9av98ljm2y75z8cek39d8ux6jk3g6vafkl5j0uj4m5ks378fhq';
    const effectiveReceiver = receiver || defaultReceiver;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ effectiveReceiver, amount, message });
        onClose(); // Close the modal after submission
    };

    return (
        <div id="send_nuts_modal" className="modal" style={{
            display: isOpen ? 'block' : 'none'
        }}>
            <div className="modal-content">
                <span className="close-button" onClick={onClose}>&times;</span>
                <h2>Send Nuts</h2>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="send_nuts_amount">Amount</label>
                    <input
                        type="number"
                        id="send_nuts_amount"
                        inputMode="decimal"
                        min="1"
                        placeholder="Enter amount of sats"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                    />
                    <label htmlFor="send_nuts_receiver">Receiver</label>
                    <textarea
                        id="send_nuts_receiver"
                        style={{ height: '90px' }}
                        value={effectiveReceiver}
                        readOnly
                    />
                    <label htmlFor="send_nuts_message">Message</label>
                    <textarea
                        id="send_nuts_message"
                        placeholder="Optional"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />
                    <button className="styled-button" id="send_nuts_submit" type="submit">OK</button>
                </form>
            </div>
        </div>
    );
};

export default SendNutsModal;
