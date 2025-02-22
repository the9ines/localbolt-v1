
import { configureChains, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { EthereumClient, w3mConnectors, w3mProvider } from '@web3modal/ethereum'
import { defaultWalletConnectModalConfig } from '@web3modal/core'

// Configure WalletKit options
const modalConfig = defaultWalletConnectModalConfig({
  themeMode: 'dark',
  themeVariables: {
    '--w3m-font-family': 'Roboto, sans-serif',
    '--w3m-accent-color': '#39FF14' // Matches our neon green theme
  }
})

const projectId = 'YOUR_WALLETCONNECT_PROJECT_ID'

const chains = [mainnet, sepolia]

const { publicClient } = configureChains(chains, [w3mProvider({ projectId })])

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: w3mConnectors({ 
    projectId, 
    chains,
    version: 2, // Use WalletConnect v2
    modalConfig
  }),
  publicClient
})

export const ethereumClient = new EthereumClient(wagmiConfig, chains)
