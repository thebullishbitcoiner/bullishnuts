import React, { useState, useEffect } from 'react';
import ContactModal from './ContactModal';

const Contacts = () => {
    const [contacts, setContacts] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const savedContacts = JSON.parse(localStorage.getItem('contacts')) || [];
        setContacts(savedContacts);
    }, []);

    const addContact = (newContact) => {
        const updatedContacts = [...contacts, newContact];
        setContacts(updatedContacts);
        localStorage.setItem('contacts', JSON.stringify(updatedContacts));
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
                <div className="contact-row" key={index}>
                    <span>{contact.name}</span>
                </div>
            ))}
            {isModalOpen && <ContactModal onClose={() => setIsModalOpen(false)} onSave={addContact} />}
        </div>
    );
};

export default Contacts;
