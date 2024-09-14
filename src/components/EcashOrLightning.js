import React from 'react';

const EcashOrLightning = ({ isOpen, onClose, onOptionSelect, label }) => {
    if (!isOpen) return null;

    return (
        <div className="ecash_or_lightning_modal">
            <div className="modal-content">
                <h2>{label}</h2>
                <div className="button-container">
                    <button className="styled-button" onClick={() => onOptionSelect('Ecash')}>Ecash</button>
                    <button className="styled-button" onClick={() => onOptionSelect('Lightning')}>Lightning</button>
                </div>
                <button className="close-button" onClick={onClose}>&times;</button>
            </div>
        </div>
    );
};

export default EcashOrLightning;
