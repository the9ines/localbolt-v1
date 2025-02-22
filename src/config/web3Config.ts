
import { configureChains, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { EthereumClient, w3mConnectors, w3mProvider } from '@web3modal/ethereum'
import { Web3Modal } from '@web3modal/react'

const projectId = 'YOUR_WALLETCONNECT_PROJECT_ID'

const chains = [mainnet, sepolia]

const { publicClient } = configureChains(chains, [w3mProvider({ projectId })])

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: w3mConnectors({ 
    projectId, 
    chains,
    projectId,
  }),
  publicClient
})

export const ethereumClient = new EthereumClient(wagmiConfig, chains)
