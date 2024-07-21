import React, { useState } from 'react';

const LightningModal = ({ contacts, onClose, onSend }) => {
  const [invoiceOrAddress, setInvoiceOrAddress] = useState('');
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const handleContactSelect = (contact) => {
    setInvoiceOrAddress(`${contact.npub}@npub.cash`);
    setIsContactModalOpen(false);
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Send Lightning</h2>
        <div className="input-container">
          <input
            type="text"
            placeholder="Lightning invoice or address"
            value={invoiceOrAddress}
            onChange={(e) => setInvoiceOrAddress(e.target.value)}
          />
          <button
            className="contact-button"
            onClick={() => setIsContactModalOpen(true)}
          >
            👤
          </button>
        </div>
        <button className="styled-button" onClick={() => onSend(invoiceOrAddress)}>Send</button>
        <button className="styled-button" onClick={onClose}>Close</button>
      </div>

      {isContactModalOpen && (
        <div className="modal">
          <div className="modal-content">
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
            <button className="styled-button" onClick={() => setIsContactModalOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LightningModal;
