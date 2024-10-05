import React, { useState, useEffect } from 'react';
import ContactModal from './ContactModal';

const Contacts = ({ onContactSelect, updateContacts }) => {
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
        updateContacts(updatedContacts);
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
                    setIsModalOpen(true);
                }}>+</button>
            </div>
            {contacts.length === 0 ? ( // Check if contacts array is empty
                <p>Add contacts by name and npub. This will allow you to send Lightning payments to their <a href="https://npub.cash/">npub.cash</a> address.</p> 
            ) : (
                contacts
                    .map((contact, index) => ({ contact, index })) // Create an array of objects with contact and original index
                    .slice() // Create a shallow copy of the array
                    .sort((a, b) => {
                        const nameA = a.contact.name.toUpperCase(); // Ignore case
                        const nameB = b.contact.name.toUpperCase(); // Ignore case
                        if (nameA < nameB) return -1;
                        if (nameA > nameB) return 1;
                        return 0;
                    })
                    .map(({ contact, index }) => (
                        <div className="contact-row" key={index}>
                            <span onClick={() => onContactSelect(contact)}>{contact.name}</span>
                            <button className="delete-button" onClick={() => confirmDeleteContact(index)}>×</button>
                        </div>
                    ))
            )}
            {isModalOpen && <ContactModal onClose={() => setIsModalOpen(false)} onSave={addContact} />}
            {isConfirmModalOpen && (
                <div className="delete_contact_modal">
                    <div className="modal-content">
                        <p>Are you sure you want to delete &quot;{contacts[deleteIndex].name}&quot;?</p>
                        <button className="styled-button" onClick={deleteContact}>Yes</button>
                        <button className="styled-button" onClick={() => setIsConfirmModalOpen(false)}>No</button>
                    </div>
                </div>
            )}
        </div>

    );
};

export default Contacts;
