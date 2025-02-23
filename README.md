
# LocalBolt - Secure P2P File Transfer

A private, secure P2P file sharing application with end-to-end encryption. Transfer files directly between devices without servers or storage limits.

## Project Setup

### Important Note
This project requires the GPT Engineer script to be present in the HTML file for proper functionality. Do not remove or modify the following script tag from index.html:
```html
<script src="https://cdn.gpteng.co/gptengineer.js" type="module"></script>
```

### Prerequisites

- Node.js & npm - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- A modern web browser that supports WebRTC

### Local Development

1. Clone the repository:
```sh
git clone <YOUR_GIT_URL>
```

2. Navigate to the project directory:
```sh
cd <YOUR_PROJECT_NAME>
```

3. Install dependencies:
```sh
npm install
```

4. Start the development server:
```sh
npm run dev
```

The app will be available at `http://localhost:8080`

### Project Structure

- `/src` - Source code
  - `/components` - React components
  - `/services` - Core services including WebRTC implementation
  - `/hooks` - Custom React hooks
  - `/pages` - Page components
  - `/types` - TypeScript type definitions

### Technologies Used

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- WebRTC for P2P file transfer
- TweetNaCl.js for encryption

## Privacy & Security

- Zero data storage - all transfers are peer-to-peer
- No server storage or databases
- End-to-end encryption
- No tracking or analytics
- No cookies or local storage

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
