import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboard } from '@fortawesome/free-regular-svg-icons';
import { AddressBookIcon } from "@bitcoin-design/bitcoin-icons-react/filled";
import * as bolt11Decoder from "light-bolt11-decoder";

const LightningModal = ({ contacts, onClose, onSend, isLightningModalOpen, initialValue }) => {
    const [invoiceOrAddress, setInvoiceOrAddress] = useState('');
    const [invoiceInfo, setInvoiceInfo] = useState('');
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);

    // Effect to set the initial value when the modal opens
    useEffect(() => {
        if (isLightningModalOpen) {
            setInvoiceOrAddress(initialValue || ''); // Set initial value or empty string
        }
        if (initialValue) {
            getInvoiceInfo(initialValue);
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
                getInvoiceInfo(text);
            })
            .catch(err => {
                console.error('Failed to read clipboard contents: ', err);
            });
    }

    function getInvoiceInfo(botl11invoice) {
        // Clear any existing invoice info
        setInvoiceInfo('');

        try {
            const invoice = bolt11Decoder.decode(botl11invoice); // Decode the invoice
            const sections = invoice.sections; // Get the sections array

            // Initialize variables to hold the amount and description
            let amount = '';
            let description = '';

            // Loop through the sections to find amount and description
            sections.forEach(section => {
                if (section.name === 'amount') {
                    amount = `${section.value / 1000} sats`; // Get the amount value
                }
                if (section.name === 'description') {
                    description = section.value; // Get the description value
                }
            });

            // Set the invoiceInfo state to show amount and description
            setInvoiceInfo(`Amount: ${amount}\nDescription: ${description}`);
        } catch (error) {
            console.error('Error decoding invoice:', error); // Log the error
        }
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
                {/* Conditional rendering of the invoice info */}
                {invoiceInfo && (
                    <textarea
                        id="invoice_info"
                        value={invoiceInfo}
                        readOnly
                    ></textarea>
                )}
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
