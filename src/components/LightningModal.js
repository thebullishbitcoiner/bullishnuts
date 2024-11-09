import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboard } from '@fortawesome/free-regular-svg-icons';
import { AddressBookIcon } from "@bitcoin-design/bitcoin-icons-react/filled";

const LightningModal = ({ contacts, onClose, onSend, isLightningModalOpen, initialValue }) => {
    const [invoiceOrAddress, setInvoiceOrAddress] = useState('');
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);

    // Effect to set the initial value when the modal opens
    useEffect(() => {
        if (isLightningModalOpen) {
            setInvoiceOrAddress(initialValue || ''); // Set initial value or empty string
        }
    }, [isLightningModalOpen, initialValue]);

    const handleContactSelect = (contact) => {
        setInvoiceOrAddress(`${contact.npub}@npub.cash`);
        setIsContactModalOpen(false);
    };

    function pasteFromClipboard() {
        navigator.clipboard.readText()
            .then(text => {
                setInvoiceOrAddress(text);
            })
            .catch(err => {
                console.error('Failed to read clipboard contents: ', err);
            });
    }

    return (
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
                    <div className="stacked_button_container">
                        <button className="square_button" onClick={() => setIsContactModalOpen(true)}>
                            <AddressBookIcon style={{ height: "21px", width: "21px" }} />
                        </button>
                        <button className='square_button' onClick={pasteFromClipboard}>
                            <FontAwesomeIcon icon={faClipboard} />
                        </button>
                    </div>
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
