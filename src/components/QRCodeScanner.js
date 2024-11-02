import React, { useState, useEffect, useRef } from 'react';
import QrScanner from 'qr-scanner';
import { CrossIcon } from "@bitcoin-design/bitcoin-icons-react/filled";

const QRCodeScanner = ({ onClose = () => { }, isScanQRModalOpen }) => {
    const [data, setData] = useState('No data scanned yet');
    const [isBackCamera, setIsBackCamera] = useState(true); // State to track camera
    const videoRef = useRef(null); // Reference for the video element

    useEffect(() => {
        // Initialize the QR scanner
        const qrScanner = new QrScanner(videoRef.current, result => {
            setData(result.data); // Set scanned data as a string
        }, {
            facingMode: isBackCamera ? 'environment' : 'user',
        });

        // Start scanning
        qrScanner.start();

        // Cleanup function to stop the scanner
        return () => {
            qrScanner.stop();
        };
    }, [isBackCamera]); // Re-run effect when camera mode changes

    const toggleCamera = () => {
        setIsBackCamera(prev => !prev);
    };

    return (
        <div id="scan_qr_modal" className="modal" style={{
            display: isScanQRModalOpen ? 'block' : 'none'
        }}>
            <div className="modal-content">
                <h2>QR Code Scanner</h2>
                <button onClick={onClose}>
                    <CrossIcon style={{ height: '21px', width: '21px', position: 'absolute', top: '15px', right: '15px' }} />
                </button>
                <div className="scanner-container">
                    <video ref={videoRef} style={{ width: '100%' }} />
                    <div className="highlight-scan-region" />
                </div>
                <textarea
                    value={data} // Use value prop instead of children
                    readOnly // Make it read-only if you don't want to allow editing
                    style={{ width: '100%', height: '100px', marginTop: '10px' }} // Adjust styles as needed
                />
                <button onClick={toggleCamera} style={{ marginTop: '10px' }}>
                    {isBackCamera ? 'Switch to Front Camera' : 'Switch to Back Camera'}
                </button>
            </div>
        </div>
    );
};

export default QRCodeScanner;
