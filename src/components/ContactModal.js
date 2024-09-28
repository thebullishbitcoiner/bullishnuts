import React, { useState } from 'react';

const ContactModal = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [npub, setNpub] = useState('');

  const handleSave = () => {
    if (name && npub) {
      onSave({ name, npub });
      onClose();
    } else {
      alert('Please fill in both fields.');
    }
  };

  return (
    <div className="add_contact_modal">
      <div className="modal-content">
        <span className="close-button" onClick={onClose}>&times;</span>
        <h2>Add Contact</h2>
        <div className="input-group">
          <label htmlFor="contact_name">Name:</label>
          <input type="text" id="contact_name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="input-group">
          <label htmlFor="contact_npub">Npub:</label>
          <input type="text" id="contact_npub" value={npub} onChange={(e) => setNpub(e.target.value)} />
        </div>
        <button className="styled-button" onClick={handleSave}>Save</button>
      </div>
    </div>
  );
};

export default ContactModal;
