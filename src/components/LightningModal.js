import React, { useState } from 'react';

const LightningModal = ({ contacts, onClose, onSend }) => {
    const [invoiceOrAddress, setInvoiceOrAddress] = useState('');
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);

    const handleContactSelect = (contact) => {
        setInvoiceOrAddress(`${contact.npub}@npub.cash`);
        setIsContactModalOpen(false);
    };

    return (
        <div className="send_lightning_modal">
            <div className="modal-content">
                <span className="close-button" onClick={onClose}>&times;</span>
                <h2>Send Lightning</h2>
                <p>Enter invoice or address</p>
                <div className="input-container">
                    <input
                        type="text"
                        id="send_lightning_input"
                        placeholder="lnbc..."
                        value={invoiceOrAddress}
                        onChange={(e) => setInvoiceOrAddress(e.target.value)}
                    />
                    <button
                        className="select_contact_button"
                        onClick={() => setIsContactModalOpen(true)}
                    >
                        👤
                    </button>
                </div>
                <button className="styled-button" onClick={() => onSend(invoiceOrAddress)}>Send</button>
            </div>

            {isContactModalOpen && (
                <div className="select_contact_modal">
                    <div className="modal-content">
                        <span className="close-button" onClick={() => setIsContactModalOpen(false)}>&times;</span>
                        <h2>Select Contact</h2>
                        {contacts.map((contact, index) => (
                            <div
                                key={index}
                                className="contact-row"
                                onClick={() => handleContactSelect(contact)}
                            >
                                {contact.name}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LightningModal;
