import React, { useState, useEffect } from 'react';
import ContactModal from './ContactModal';

const Contacts = ({ onContactSelect }) => {
    const [contacts, setContacts] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteIndex, setDeleteIndex] = useState(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    useEffect(() => {
        const savedContacts = JSON.parse(localStorage.getItem('contacts')) || [];
        setContacts(savedContacts);
    }, []);

    const addContact = (newContact) => {
        const updatedContacts = [...contacts, newContact];
        setContacts(updatedContacts);
        localStorage.setItem('contacts', JSON.stringify(updatedContacts));
    };

    const confirmDeleteContact = (index) => {
        setDeleteIndex(index);
        setIsConfirmModalOpen(true);
    };

    const deleteContact = () => {
        const updatedContacts = contacts.filter((_, i) => i !== deleteIndex);
        setContacts(updatedContacts);
        localStorage.setItem('contacts', JSON.stringify(updatedContacts));
        setIsConfirmModalOpen(false);
    };

    return (
        <div className="contacts-container">
            <div className="header">
                <h2>Contacts</h2>
                <button className="add-button" onClick={() => {
                    console.log("Button clicked");
                    setIsModalOpen(true);
                }}>+</button>
            </div>
            {contacts.map((contact, index) => (
                <div className="contact-row" key={index} >
                    <span onClick={() => onContactSelect(contact)}>{contact.name}</span>
                    <button className="delete-button" onClick={() => confirmDeleteContact(index)}>×</button>
                </div>
            ))}
            {isModalOpen && <ContactModal onClose={() => setIsModalOpen(false)} onSave={addContact} />}
            {isConfirmModalOpen && (
                <div className="delete_contact_modal">
                    <div className="modal-content">
                        <p>Are you sure you want to delete "{contacts[deleteIndex].name}"?</p>
                        <button className="styled-button" onClick={deleteContact}>Yes</button>
                        <button className="styled-button" onClick={() => setIsConfirmModalOpen(false)}>No</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contacts;
