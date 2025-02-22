
import { useState } from 'react'
import { useWeb3Modal } from '@web3modal/react'
import { useAccount, useDisconnect } from 'wagmi'
import { Button } from "@/components/ui/button"
import { Wallet } from "lucide-react"

export const WalletButton = () => {
  const [loading, setLoading] = useState(false)
  const { open } = useWeb3Modal()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  const handleClick = async () => {
    setLoading(true)
    if (isConnected) {
      await disconnect()
    } else {
      await open()
    }
    setLoading(false)
  }

  return (
    <Button 
      variant="outline" 
      onClick={handleClick}
      disabled={loading}
      className="gap-2"
    >
      <Wallet className="h-4 w-4" />
      {isConnected ? 
        `${address?.slice(0, 6)}...${address?.slice(-4)}` : 
        'Connect Wallet'
      }
    </Button>
  )
}
