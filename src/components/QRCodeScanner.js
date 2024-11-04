import React, { useState, useEffect, useRef } from 'react';
import QrScanner from 'qr-scanner';
import { CrossIcon } from "@bitcoin-design/bitcoin-icons-react/filled";

const QRCodeScanner = ({ onClose = () => { }, isScanQRModalOpen }) => {
    const [data, setData] = useState('No data scanned yet');
    const videoRef = useRef(null); // Reference for the video element

    useEffect(() => {
        // Initialize the QR scanner to always use the back camera
        const qrScanner = new QrScanner(videoRef.current, result => {
            setData(result.data); // Set scanned data as a string
            qrScanner.stop(); // Stop scanning once data has been set
        }, {
            facingMode: 'environment', // Always use the back camera
            returnDetailedScanResult: true, // Return detailed scan result
            highlightScanRegion: true, // Highlight the scan region
            highlightCodeOutline: true, // Highlight the QR code outline
            onDecodeError: () => { }, // Handle decode errors if needed
        });

        // Start scanning
        qrScanner.start();

        // Cleanup function to stop the scanner
        return () => {
            qrScanner.stop();
        };
    }, []); // No dependencies, runs only once on mount

    return (
        <div id="scan_qr_modal" className="modal" style={{
            display: isScanQRModalOpen ? 'block' : 'none'
        }}>
            <div className="modal-content">
                <h2>QR Code Scanner</h2>
                <button onClick={onClose}>
                    <CrossIcon style={{ height: '21px', width: '21px', position: 'absolute', top: '15px', right: '15px' }} />
                </button>
                <div className="scanner-container" style={{ position: 'relative', width: '100%', height: '100%', maxWidth: '400px', maxHeight: '400px' }}>
                    <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {/* Highlight corners with yellow right angles */}
                    <div style={{
                        position: 'absolute',
                        top: '0',
                        left: '0',
                        width: '30px',
                        height: '30px',
                        borderTop: '5px solid #ff9900',
                        borderLeft: '5px solid #ff9900',
                        backgroundColor: 'transparent',
                    }} />
                    <div style={{
                        position: 'absolute',
                        top: '0',
                        right: '0',
                        width: '30px',
                        height: '30px',
                        borderTop: '5px solid #ff9900',
                        borderRight: '5px solid #ff9900',
                        backgroundColor: 'transparent',
                    }} />
                    <div style={{
                        position: 'absolute',
                        bottom: '0',
                        left: '0',
                        width: '30px',
                        height: '30px',
                        borderBottom: '5px solid #ff9900',
                        borderLeft: '5px solid #ff9900',
                        backgroundColor: 'transparent',
                    }} />
                    <div style={{
                        position: 'absolute',
                        bottom: '0',
                        right: '0',
                        width: '30px',
                        height: '30px',
                        borderBottom: '5px solid #ff9900',
                        borderRight: '5px solid #ff9900',
                        backgroundColor: 'transparent',
                    }} />
                </div>
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
