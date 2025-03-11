import React, { useState, useEffect } from 'react';

const AutoSweepModal = ({ open, onClose, onSave }) => {
  const [targetBalance, setTargetBalance] = useState('');
  const [lightningAddress, setLightningAddress] = useState('');

  // Load settings from local storage when the modal opens
  useEffect(() => {
    if (open) {
      const autoSweepSettings = JSON.parse(localStorage.getItem('autoSweep')) || {};
      setTargetBalance(autoSweepSettings.targetBalance || '');
      setLightningAddress(autoSweepSettings.lightningAddress || '');
    }
  }, [open]);

  const handleSave = () => {
    // Save settings to local storage under the "autoSweep" key
    localStorage.setItem('autoSweep', JSON.stringify({
      targetBalance: targetBalance,
      lightningAddress: lightningAddress
    }));
    
    onSave(targetBalance, lightningAddress);
    onClose();
  };

  return (
    <div id="auto_sweep_modal" className="modal" style={{ display: open ? 'block' : 'none' }}>
      <div className="modal-content">
        <span className="close-button" onClick={onClose}>&times;</span>
        <h2>Auto Sweep</h2>
        <div className="input-group">
          <label>Target Balance:</label>
          <input
            type="text"
            value={targetBalance}
            onChange={(e) => setTargetBalance(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Lightning Address:</label>
          <input
            type="text"
            value={lightningAddress}
            onChange={(e) => setLightningAddress(e.target.value)}
          />
        </div>
        <button className="styled-button" onClick={handleSave}>Save</button>
        <button className="styled-button" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};

export default AutoSweepModal;
