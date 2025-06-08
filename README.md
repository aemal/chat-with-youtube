# Chat with YouTube

A full-stack Next.js application that enables users to chat with YouTube video transcripts using ChatGPT integration. Simply paste a YouTube URL, and the app will download the transcript and allow you to ask questions, create summaries, and interact with the content through an intelligent chat interface.

## ✨ Features

- 🎥 **YouTube URL Input**: Paste any YouTube URL to extract video transcripts
- 📝 **Transcript Download**: Automatically downloads and processes video transcripts
- 🤖 **ChatGPT Integration**: Powered by OpenAI's GPT models for intelligent responses
- 💬 **Interactive Chat**: Ask questions about the video content in natural language
- 📊 **Content Summarization**: Generate summaries of YouTube videos
- 🎯 **Contextual Responses**: Get accurate answers based on the actual video content
- 🎨 **Modern UI**: Clean and responsive user interface
- ⚡ **Real-time Chat**: Instant responses with streaming support

## 🚀 Tech Stack

- **Framework**: Next.js 15.3.3 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI Integration**: OpenAI GPT API
- **YouTube Processing**: YouTube transcript extraction
- **Runtime**: Node.js 22+ (LTS)

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 22.16.0 or later (LTS recommended)
- **npm**: Version 10+ (comes with Node.js)
- **OpenAI API Key**: Get one from [OpenAI Platform](https://platform.openai.com/)

### System Requirements

- **Operating System**: macOS, Windows (including WSL), or Linux
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Storage**: 1GB free space

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/chat-with-youtube.git
cd chat-with-youtube
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Database Configuration (if using)
DATABASE_URL=your_database_url_here
```

**Important**: Never commit your `.env.local` file to version control. The `.env.local` file is already included in `.gitignore`.

### 4. Get Your OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key and add it to your `.env.local` file

## 🏃‍♂️ Running the Application

### Development Mode

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
# Build the application
npm run build

# Start the production server
npm run start
```

### Linting and Type Checking

```bash
# Run ESLint
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Type checking
npm run type-check
```

## 📖 Usage

1. **Start the Application**: Run `npm run dev` and open [http://localhost:3000](http://localhost:3000)

2. **Enter YouTube URL**: Paste any YouTube video URL into the input field

3. **Wait for Processing**: The app will automatically download and process the video transcript

4. **Start Chatting**: Once processed, you can:
   - Ask questions about the video content
   - Request summaries of specific sections
   - Get explanations of complex topics discussed
   - Generate key takeaways

### Example Interactions

```
User: "What are the main points discussed in this video?"
AI: "Based on the transcript, the main points are: 1) Introduction to React hooks, 2) useState and useEffect examples, 3) Best practices for custom hooks..."

User: "Can you summarize the section about useEffect?"
AI: "The useEffect section covers how to handle side effects in React components, including cleanup functions and dependency arrays..."
```

## 🏗️ Project Structure

```
chat-with-youtube/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── chat/         # Chat endpoint
│   │   └── transcript/   # YouTube transcript processing
│   ├── components/       # React components
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home page
├── components/           # Reusable components
│   ├── ui/              # UI components
│   ├── ChatInterface.tsx
│   ├── URLInput.tsx
│   └── TranscriptDisplay.tsx
├── lib/                 # Utility functions
│   ├── openai.ts       # OpenAI configuration
│   ├── youtube.ts      # YouTube processing
│   └── utils.ts        # General utilities
├── types/              # TypeScript type definitions
├── public/             # Static assets
├── .env.local         # Environment variables (create this)
├── .env.example       # Environment variables template
├── next.config.js     # Next.js configuration
├── tailwind.config.js # Tailwind CSS configuration
├── tsconfig.json      # TypeScript configuration
└── package.json       # Dependencies and scripts
```

## 🔧 Configuration

### Next.js Configuration

The project uses Next.js 15.3.3 with the App Router. Key configurations:

- **TypeScript**: Enabled by default
- **ESLint**: Configured with Next.js recommended rules
- **Tailwind CSS**: For styling
- **App Router**: Modern routing system

### OpenAI Configuration

The app uses the latest OpenAI API with:
- **Model**: GPT-4 or GPT-3.5-turbo (configurable)
- **Max Tokens**: Configurable based on needs
- **Temperature**: Optimized for factual responses

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Other Platforms

The app can be deployed to any platform that supports Node.js:
- **Netlify**
- **Railway**
- **Heroku**
- **DigitalOcean App Platform**

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use ESLint and Prettier for code formatting
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

**1. OpenAI API Key Issues**
```bash
Error: OpenAI API key not found
```
- Ensure your API key is correctly set in `.env.local`
- Restart the development server after adding environment variables

**2. YouTube URL Processing Fails**
```bash
Error: Could not extract transcript
```
- Ensure the YouTube video has captions/subtitles available
- Some videos may have restricted access to transcripts

**3. Node.js Version Issues**
```bash
Error: Unsupported Node.js version
```
- Update to Node.js 22+ (LTS recommended)
- Use `nvm` to manage Node.js versions: `nvm install 22 && nvm use 22`

### Getting Help

- 📧 **Email**: [your-email@example.com]
- 🐛 **Issues**: [GitHub Issues](https://github.com/yourusername/chat-with-youtube/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourusername/chat-with-youtube/discussions)

## 🙏 Acknowledgments

- [OpenAI](https://openai.com/) for providing the GPT API
- [Next.js](https://nextjs.org/) for the amazing React framework
- [Vercel](https://vercel.com/) for hosting and deployment
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework

## 📊 Project Status

- ✅ **Core Features**: Complete
- 🔄 **Active Development**: Ongoing improvements
- 🐛 **Bug Reports**: Welcome
- 🚀 **Feature Requests**: Open to suggestions

---

**Built with ❤️ using Next.js 15.3.3 and OpenAI GPT**
