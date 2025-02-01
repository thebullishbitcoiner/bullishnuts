// import React, { useState, useEffect } from 'react';
// import NDK from "@nostr-dev-kit/ndk";
// import { decode } from 'bech32-buffer';
// import { bytesToHex } from '@noble/hashes/utils';
// import { SearchIcon } from "@bitcoin-design/bitcoin-icons-react/filled";
// import styles from './NutSplits.module.css';

// const NutSplits = ({ onSendNuts, onClose }) => {
//     const [noteId, setNoteId] = useState('');
//     const [commenters, setCommenters] = useState([]);
//     const [selectedCommenters, setSelectedCommenters] = useState({});
//     const [ndk, setNdk] = useState(null);
//     const [loading, setLoading] = useState(false); // New loading state

//     useEffect(() => {
//         const ndkInstance = new NDK({ explicitRelayUrls: ["wss://relay.damus.io", "wss://relay.primal.net"] });

//         const connectNdk = async () => {
//             try {
//                 await ndkInstance.connect();
//                 setNdk(ndkInstance);
//             } catch (error) {
//                 console.error("Failed to connect to NDK:", error);
//             }
//         };

//         connectNdk();
//     }, []);

//     const handleSearch = async () => {
//         try {
//             if (!ndk) {
//                 console.error("NDK is not initialized");
//                 return;
//             }

//             let decodedData = decode(noteId);
//             let hexID = bytesToHex(decodedData.data);

//             setLoading(true); // Set loading to true before fetching
//             try {
//                 const fetchedCommenters = await fetchCommenters(hexID);
//                 setCommenters(fetchedCommenters);
//             } catch (error) {
//                 console.error("Failed to fetch commenters:", error);
//             } finally {
//                 setLoading(false); // Set loading to false after fetching
//             }
//         } catch (error) {
//             console.error("Search failed:", error);
//         }
//     };

//     const fetchCommenters = async (noteId) => {
//         const filter2 = { kinds: [1], ['#e']: [noteId] };

//         let events;
//         try {
//             events = await ndk.fetchEvents(filter2);
//         } catch (error) {
//             console.error("Failed to fetch events:", error);
//             return [];
//         }

//         const commenters = [];
//         const existingNpubs = new Set();

//         for (const event of events) {
//             let currentPubkey = event.pubkey;
//             let currentNpub = event.author.npub;

//             if (!existingNpubs.has(currentNpub)) {
//                 let currentUser = ndk.getUser({ npub: currentNpub });
//                 await currentUser.fetchProfile();

//                 const commenter = {
//                     name: currentUser.profile.name,
//                     npub: currentNpub,
//                     pubkey: currentPubkey,
//                 };

//                 commenters.push(commenter);
//                 existingNpubs.add(currentNpub);
//             }
//         }

//         return commenters;
//     };

//     const handleCheckboxChange = (id) => {
//         setSelectedCommenters((prev) => ({
//             ...prev,
//             [id]: !prev[id],
//         }));
//     };

//     const handleSendNuts = () => {
//         const selected = Object.keys(selectedCommenters).filter(id => selectedCommenters[id]);
//         onSendNuts(selected);
//     };

//     const handleSelectAll = () => {
//         const allSelected = {};
//         commenters.forEach(commenter => {
//             allSelected[commenter.npub] = true;
//         });
//         setSelectedCommenters(allSelected);
//     };

//     const handleDeselectAll = () => {
//         setSelectedCommenters({});
//     };

//     const handleClose = () => {
//         setNoteId('');
//         setCommenters([]);
//         setSelectedCommenters({});
//         onClose();
//     };

//     return (
//         <div className="nut_splits_modal">
//             <div className="modal-content">
//                 <span className="close-button" onClick={handleClose}>&times;</span>
//                 <h2>Nut Splits</h2>
//                 <div className="input-container">
//                     <input
//                         id="nut_splits_input"
//                         value={noteId}
//                         onChange={(e) => setNoteId(e.target.value)}
//                         placeholder="Enter Nostr Note ID"
//                     />
//                     <button className="square_button" onClick={handleSearch}>
//                         <SearchIcon style={{ height: "21px", width: "21px" }} />
//                     </button>
//                 </div>
//                 <div style={{ height: '200px', overflowY: 'auto', overflowX: 'hidden', border: '1px solid #ff9900', padding: '10px', marginBottom: '10px' }}>
//                     {loading ? (
//                         <div className={styles.loadingAnimation}>
//                             <span>Loading</span>
//                             <span className={styles.dot}>.</span>
//                             <span className={styles.dot}>.</span>
//                             <span className={styles.dot}>.</span>
//                         </div>
//                     ) : (
//                         commenters.map(commenter => (
//                             <div key={commenter.npub} style={{ display: 'flex', alignItems: 'center' }}>
//                                 <input
//                                     type="checkbox"
//                                     checked={!!selectedCommenters[commenter.npub]}
//                                     onChange={() => handleCheckboxChange(commenter.npub)}
//                                 />
//                                 <span style={{ marginLeft: '8px' }}>{commenter.name ? commenter.name : commenter.npub}</span>
//                             </div>
//                         ))
//                     )}
                   
//                 </div>
//                  {/* Calculate selected and total counts */}
//                  <div style={{ marginTop: '-5px', marginBottom: '5px' }}>
//                         Selected: {Object.keys(selectedCommenters).filter(id => selectedCommenters[id]).length}/{commenters.length}
//                     </div>
//                 <div className="button-container">
//                     <button className="styled-button" onClick={handleSelectAll}>Select All</button>
//                     <button className="styled-button" onClick={handleDeselectAll}>Deselect All</button>
//                 </div>
//                 <div className="button-container">
//                     <button className="styled-button" onClick={handleSendNuts}>Send Nuts</button>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default NutSplits;

