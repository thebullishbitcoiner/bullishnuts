import React, { useState } from 'react';
import QrScanner from 'react-qr-scanner';
import { CrossIcon } from "@bitcoin-design/bitcoin-icons-react/filled";

const QRCodeScanner = ({ onClose = () => { }, isScanQRModalOpen }) => {
    const [data, setData] = useState('No data scanned yet');

    const handleScan = (data) => {
        if (data) {
            setData(data);
        }
    };

    const handleError = (err) => {
        console.error(err);
    };

    // Custom canvas configuration
    const canvasprops = {
        willReadFrequently: true, // Set this attribute to true for performance
    };

        // Video constraints to use the back camera
        const videoConstraints = {
            facingMode: { exact: "environment" } // Use the back camera
        };

    return (
        <div id="scan_qr_modal" className="modal" style={{
            display: isScanQRModalOpen ? 'block' : 'none'
        }}>
            <div className="modal-content">
                <h2>QR Code Scanner</h2>
                <button onClick={onClose} >
                    <CrossIcon style={{ height: '21px', width: '21px', position: 'absolute', top: '15px', right: '15px' }} />
                </button>
                <QrScanner
                    delay={300}
                    onError={handleError}
                    onScan={handleScan}
                    style={{ width: '100%' }}
                    canvasprops={canvasprops}
                    videoconstraints={videoConstraints} 
                />
                <textarea
                    value={data} // Use value prop instead of children
                    readOnly // Make it read-only if you don't want to allow editing
                    style={{ width: '100%', height: '100px', marginTop: '10px' }} // Adjust styles as needed
                />

            </div>
        </div>
    );
};

export default QRCodeScanner;
