
import { configureChains, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { EthereumClient, w3mConnectors, w3mProvider } from '@web3modal/ethereum'

// Configure theme options directly in modalOptions
const modalOptions = {
  themeMode: 'dark' as const,
  themeVariables: {
    '--w3m-font-family': 'Roboto, sans-serif',
    '--w3m-accent-color': '#39FF14' // Matches our neon green theme
  }
}

const projectId = 'YOUR_WALLETCONNECT_PROJECT_ID'

const chains = [mainnet, sepolia]

const { publicClient } = configureChains(chains, [w3mProvider({ projectId })])

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: w3mConnectors({ 
    projectId, 
    chains,
    version: 2 // Use WalletConnect v2
  }),
  publicClient
})

export const ethereumClient = new EthereumClient(wagmiConfig, chains)
