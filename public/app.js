// Monad Testnet Demo App
class MonadDemo {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.contractAddress = null;
        this.contractABI = null;
        this.userAddress = null;
        this.txHistory = [];
        
        this.init();
    }
    
    async init() {
        await this.loadContractInfo();
        this.setupEventListeners();
        this.checkWalletConnection();
        await this.updateContractInfo();
    }
    
    async loadContractInfo() {
        try {
            const [contractResponse, abiResponse] = await Promise.all([
                fetch('/api/contract-info'),
                fetch('/api/contract-abi')
            ]);
            
            if (contractResponse.ok) {
                const contractData = await contractResponse.json();
                this.contractAddress = contractData.address;
                document.getElementById('contractLink').href = contractData.explorerUrl;
            }
            
            if (abiResponse.ok) {
                const abiData = await abiResponse.json();
                this.contractABI = abiData.abi;
            }
        } catch (error) {
            console.error('Failed to load contract info:', error);
        }
    }
    
    setupEventListeners() {
        document.getElementById('connectBtn').addEventListener('click', () => this.connectWallet());
        document.getElementById('mintBtn').addEventListener('click', () => this.mintTokens());
        document.getElementById('transferBtn').addEventListener('click', () => this.transferTokens());
        document.getElementById('addNetworkBtn').addEventListener('click', () => this.addNetwork());
    }
    
    async checkWalletConnection() {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    await this.connectWallet(false);
                }
            } catch (error) {
                console.error('Error checking wallet connection:', error);
            }
        } else {
            this.showStatus('connectionStatus', 'Please install MetaMask or another Web3 wallet', 'error');
        }
    }
    
    async connectWallet(requestConnection = true) {
        try {
            if (typeof window.ethereum === 'undefined') {
                throw new Error('Please install MetaMask');
            }
            
            if (requestConnection) {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
            }
            
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            this.userAddress = await this.signer.getAddress();
            
            // Check network
            const network = await this.provider.getNetwork();
            if (network.chainId !== 41454) {
                this.showStatus('connectionStatus', 'Please switch to Monad Testnet', 'error');
                return;
            }
            
            // Setup contract
            if (this.contractAddress && this.contractABI) {
                this.contract = new ethers.Contract(this.contractAddress, this.contractABI, this.signer);
            }
            
            await this.updateUI();
            this.showStatus('connectionStatus', 'Wallet connected successfully!', 'success');
            
        } catch (error) {
            console.error('Connection error:', error);
            this.showStatus('connectionStatus', `Connection failed: ${error.message}`, 'error');
        }
    }
    
    async updateUI() {
        if (!this.userAddress) return;
        
        // Update account info
        document.getElementById('accountAddress').textContent = this.formatAddress(this.userAddress);
        
        // Get balance
        const balance = await this.provider.getBalance(this.userAddress);
        document.getElementById('accountBalance').textContent = ethers.utils.formatEther(balance);
        
        // Show connected UI
        document.getElementById('accountInfo').classList.remove('hidden');
        document.getElementById('connectBtn').textContent = 'Connected';
        document.getElementById('connectBtn').disabled = true;
        
        // Enable interaction buttons
        document.getElementById('mintBtn').disabled = false;
        document.getElementById('transferBtn').disabled = false;
        
        await this.updateTokenInfo();
    }
    
    async updateContractInfo() {
        try {
            const response = await fetch('/api/contract-info');
            if (response.ok) {
                const data = await response.json();
                document.getElementById('tokenName').textContent = data.name || 'N/A';
                document.getElementById('tokenSymbol').textContent = data.symbol || 'N/A';
                document.getElementById('totalSupply').textContent = data.totalSupply ? 
                    ethers.utils.formatEther(data.totalSupply) : 'N/A';
                document.getElementById('maxSupply').textContent = data.maxSupply ? 
                    ethers.utils.formatEther(data.maxSupply) : 'N/A';
            }
        } catch (error) {
            console.error('Failed to update contract info:', error);
        }
    }
    
    async updateTokenInfo() {
        if (!this.contract || !this.userAddress) return;
        
        try {
            // Get user token balance
            const balance = await this.contract.balanceOf(this.userAddress);
            document.getElementById('userBalance').textContent = ethers.utils.formatEther(balance) + ' CHAL';
            
            // Check whitelist status
            const isWhitelisted = await this.contract.whitelist(this.userAddress);
            document.getElementById('whitelistStatus').textContent = isWhitelisted ? '✅ Whitelisted' : '❌ Not Whitelisted';
            document.getElementById('whitelistStatus').style.color = isWhitelisted ? 'green' : 'red';
            
        } catch (error) {
            console.error('Failed to update token info:', error);
        }
    }
    
    async mintTokens() {
        if (!this.contract) return;
        
        const amount = document.getElementById('mintAmount').value;
        if (!amount || amount <= 0) {
            this.showStatus('mintStatus', 'Please enter a valid amount', 'error');
            return;
        }
        
        if (amount > 1000) {
            this.showStatus('mintStatus', 'Maximum mint amount is 1000 tokens', 'error');
            return;
        }
        
        try {
            this.showStatus('mintStatus', 'Minting tokens... <div class=\"loading\"></div>', 'info');
            
            const mintAmount = ethers.utils.parseEther(amount);
            const tx = await this.contract.whitelistMint(mintAmount);
            
            this.showStatus('mintStatus', `Transaction sent: ${tx.hash}`, 'info');
            this.addTransaction('Mint', tx.hash, `${amount} CHAL`);
            
            await tx.wait();
            
            this.showStatus('mintStatus', `Successfully minted ${amount} CHAL tokens!`, 'success');
            await this.updateTokenInfo();
            
        } catch (error) {
            console.error('Mint error:', error);
            this.showStatus('mintStatus', `Mint failed: ${error.message}`, 'error');
        }
    }
    
    async transferTokens() {
        if (!this.contract) return;
        
        const to = document.getElementById('transferTo').value;
        const amount = document.getElementById('transferAmount').value;
        
        if (!to || !ethers.utils.isAddress(to)) {
            this.showStatus('transferStatus', 'Please enter a valid address', 'error');
            return;
        }
        
        if (!amount || amount <= 0) {
            this.showStatus('transferStatus', 'Please enter a valid amount', 'error');
            return;
        }
        
        try {
            this.showStatus('transferStatus', 'Transferring tokens... <div class=\"loading\"></div>', 'info');
            
            const transferAmount = ethers.utils.parseEther(amount);
            const tx = await this.contract.transfer(to, transferAmount);
            
            this.showStatus('transferStatus', `Transaction sent: ${tx.hash}`, 'info');
            this.addTransaction('Transfer', tx.hash, `${amount} CHAL to ${this.formatAddress(to)}`);
            
            await tx.wait();
            
            this.showStatus('transferStatus', `Successfully transferred ${amount} CHAL!`, 'success');
            await this.updateTokenInfo();
            
            // Clear form
            document.getElementById('transferTo').value = '';
            document.getElementById('transferAmount').value = '';
            
        } catch (error) {
            console.error('Transfer error:', error);
            this.showStatus('transferStatus', `Transfer failed: ${error.message}`, 'error');
        }
    }
    
    async addNetwork() {
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0xA1F6', // 41454 in hex
                    chainName: 'Monad Testnet',
                    nativeCurrency: {
                        name: 'Monad',
                        symbol: 'MON',
                        decimals: 18
                    },
                    rpcUrls: ['https://testnet1.monad.xyz'],
                    blockExplorerUrls: ['https://explorer-testnet.monad.xyz']
                }]
            });
            
            alert('Monad Testnet added to your wallet!');
            
        } catch (error) {
            console.error('Failed to add network:', error);
            alert('Failed to add network: ' + error.message);
        }
    }
    
    showStatus(elementId, message, type) {
        const element = document.getElementById(elementId);
        element.innerHTML = message;
        element.className = `status ${type}`;
        element.classList.remove('hidden');
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                element.classList.add('hidden');
            }, 5000);
        }
    }
    
    addTransaction(type, hash, details) {
        this.txHistory.unshift({
            type,
            hash,
            details,
            timestamp: new Date()
        });
        
        this.updateTransactionHistory();
    }
    
    updateTransactionHistory() {
        const historyElement = document.getElementById('txHistory');
        
        if (this.txHistory.length === 0) {
            historyElement.innerHTML = '<p>No transactions yet...</p>';
            return;
        }
        
        const historyHTML = this.txHistory.slice(0, 10).map(tx => `
            <div style=\"padding: 10px; border-bottom: 1px solid #eee; margin-bottom: 10px;\">
                <div style=\"display: flex; justify-content: space-between; align-items: center;\">
                    <strong>${tx.type}</strong>
                    <span style=\"font-size: 12px; color: #666;\">${tx.timestamp.toLocaleString()}</span>
                </div>
                <div style=\"font-size: 14px; margin: 5px 0;\">${tx.details}</div>
                <div>
                    <a href=\"https://explorer-testnet.monad.xyz/tx/${tx.hash}\" target=\"_blank\" class=\"link\">
                        View Transaction
                    </a>
                </div>
            </div>
        `).join('');
        
        historyElement.innerHTML = historyHTML;
    }
    
    formatAddress(address) {
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
}

// Initialize the app when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new MonadDemo();
});

// Handle account changes
if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            location.reload();
        } else {
            location.reload();
        }
    });
    
    window.ethereum.on('chainChanged', (chainId) => {
        location.reload();
    });
}