import React, { useState } from 'react';

const LightningModal = ({ contacts, onClose, onSend, isLightningModalOpen }) => {
    const [invoiceOrAddress, setInvoiceOrAddress] = useState('');
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);

    const handleContactSelect = (contact) => {
        setInvoiceOrAddress(`${contact.npub}@npub.cash`);
        setIsContactModalOpen(false);
    };

    return (
        /* The isLightningModalOpen prop is used the to determine whether or not to display the modal */
        <div id="send_lightning_modal" className="modal" style={{
            display: isLightningModalOpen ? 'block' : 'none'
        }}>
            <div className="modal-content">
                <span className="close-button" onClick={onClose}>&times;</span>
                <h2>Send Lightning</h2>
                <div className="input-container">
                    <textarea
                        id="send_lightning_input"
                        placeholder="Lightning invoice or address"
                        value={invoiceOrAddress}
                        onChange={(e) => setInvoiceOrAddress(e.target.value)}
                        rows="4"
                        cols="42"
                    ></textarea>
                    <button className="select_contact_button" onClick={() => setIsContactModalOpen(true)}>𓅦</button>
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
