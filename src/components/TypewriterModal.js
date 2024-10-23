import React, { useState, useEffect } from 'react';
import styles from './TypewriterModal.module.css'; // Adjust the path as necessary

const TypewriterModal = ({ messages, onClose }) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true); // Track if currently typing
  const [typeInterval, setTypeInterval] = useState(null); // Store the typing interval ID

  useEffect(() => {
    if (currentMessageIndex < messages.length) {
      const message = messages[currentMessageIndex];
      let charIndex = 0;

      // Start with the first character displayed
      setDisplayedText(message.charAt(0)); // Display the first character immediately

      // Typing effect
      const interval = setInterval(() => {
        if (charIndex < message.length) {
          setDisplayedText((prev) => prev + message[charIndex]);
          charIndex++;
        } else {
          clearInterval(interval);
          setIsTyping(false); // Stop typing when the message is fully displayed
        }
      }, 50); // Adjust typing speed here

      setTypeInterval(interval); // Store the interval ID

      return () => clearInterval(interval); // Cleanup on unmount or when message changes
    }
  }, [currentMessageIndex, messages]);

  const handleTap = () => {
    if (isTyping) {
      // If currently typing, stop typing and show the full message
      clearInterval(typeInterval); // Clear the typing interval
      setDisplayedText(messages[currentMessageIndex]); // Show the full message
      setIsTyping(false); // Stop typing
    } else {
      // If not typing, advance to the next message
      if (currentMessageIndex < messages.length - 1) {
        setCurrentMessageIndex((prev) => prev + 1);
        setDisplayedText(''); // Reset displayed text for the next message
        setIsTyping(true); // Start typing the next message
      } else {
        onClose(); // Close modal if it's the last message
      }
    }
  };

  return (
    <div className={styles.dialogbox} onClick={handleTap}>
      <div>{displayedText}</div>
      {/* Only show the arrow if there are more messages to display */}
      {currentMessageIndex < messages.length - 1 && (
        <div className={styles.arrow}></div>
      )}
    </div>
  );
};

export default TypewriterModal;
