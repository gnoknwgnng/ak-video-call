# Omegle Gender Match Web App

A web application similar to Omegle that allows users to have random video calls with people of the opposite gender. This application features an enhanced interactive interface with animations, sound effects, and a modern design.

## Features

- Gender-based matching (Male/Female/Other)
- Real-time video calling using WebRTC
- Text chat during calls
- Queue system for matching users
- Responsive design for desktop and mobile
- Session timer
- Interactive UI with animations and transitions
- Sound effects for enhanced user experience
- Modern gradient-based design
- Dynamic waiting messages

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript, WebRTC
- **Backend**: Node.js, Express, Socket.IO
- **Real-time Communication**: WebRTC, Socket.IO
- **STUN Servers**: Google STUN servers

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```bash
   cd omegel
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

### Development Mode

To run the application in development mode with auto-restart:

```bash
npm run dev
```

### Production Mode

To run the application in production mode:

```bash
npm start
```

The application will be available at `http://localhost:3000`

## Deployment

### Deploy to Vercel (Recommended)

This application can be deployed to Vercel with minimal configuration:

1. Install Vercel CLI: `npm install -g vercel`
2. Login to Vercel: `vercel login`
3. Deploy: `vercel --prod`

For detailed instructions, see [DEPLOYMENT-VERCEL.md](DEPLOYMENT-VERCEL.md).

### Other Platforms

For deployment instructions to other platforms including Heroku, AWS, Google Cloud, DigitalOcean, and traditional VPS deployments, please refer to the comprehensive [DEPLOYMENT.md](DEPLOYMENT.md) guide.

## How It Works

1. Users select their gender on the landing page
2. Users are added to gender-specific queues
3. The server matches users of opposite genders when available
4. WebRTC establishes a peer-to-peer connection for video calling
5. Socket.IO handles signaling and chat messages

## Project Structure

```
omegel/
├── server.js              # Main server file
├── package.json           # Project dependencies and scripts
├── README.md              # This file
└── public/                # Frontend files
    ├── index.html         # Main HTML file
    ├── styles.css         # Stylesheet
    └── script.js          # Client-side JavaScript
```

## Configuration

The application uses Google's public STUN servers by default:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`

For production use, you might want to add TURN servers to ensure connectivity in restricted networks.

## Limitations

- No persistent user accounts (anonymous by design)
- No recording functionality
- No advanced moderation features
- Basic UI/UX (can be enhanced)

## Future Enhancements

- Add TURN server support for better connectivity
- Implement user reporting/blocking features
- Add session time limits
- Add interest-based matching
- Implement moderation tools
- Add virtual backgrounds and filters
- Implement user profiles and preferences
- Add social sharing features

## Scaling for Production

For large-scale deployment supporting thousands to millions of concurrent users, please refer to the detailed scaling guide in `scaling-guide.md`. Key considerations include:

- Replacing in-memory queues with Redis
- Implementing load balancing
- Adding database persistence with MongoDB
- Using TURN servers for better connectivity
- Implementing monitoring and analytics

## License

This project is open source and available under the MIT License.