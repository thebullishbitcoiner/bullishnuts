import React, { useState, useEffect, useRef } from 'react';
import QrScanner from 'qr-scanner';
import { CrossIcon } from "@bitcoin-design/bitcoin-icons-react/filled";

const QRCodeScanner = ({ onClose = () => { }, isScanQRModalOpen, onScan }) => {
    const [data, setData] = useState('No data scanned yet');
    const videoRef = useRef(null); // Reference for the video element

    useEffect(() => {
        // Initialize the QR scanner to always use the back camera
        const qrScanner = new QrScanner(videoRef.current, result => {
            setData(result.data); // Set scanned data as a string
            onScan(result.data); // Call the onScan prop with the scanned data
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
    }, [onScan]); // Add onScan to dependencies

    return (
        <div id="scan_qr_modal" className="modal" style={{
            display: isScanQRModalOpen ? 'block' : 'none'
        }}>
            <div className="modal-content">
                <button onClick={onClose}>
                    <CrossIcon style={{ height: '21px', width: '21px', position: 'absolute', top: '15px', right: '15px' }} />
                </button>
                <div className="scanner-container" style={{ position: 'relative', width: '100%', height: '100%', maxWidth: '400px', maxHeight: '400px' }}>
                    <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
            </div>
        </div>
    );
};

export default QRCodeScanner;
