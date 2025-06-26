import React from 'react';

export default function Contact() {
  return (
    <div>
      <h1>Contact Page</h1>
      <img src="/contact.png" />
      <form>
        <input type="text" name="name" />
        <button type="submit">Send</button>
      </form>
    </div>
  );
} 