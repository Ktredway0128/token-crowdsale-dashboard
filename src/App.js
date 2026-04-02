import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import TokenAirdropABI from './contracts/TokenAirdrop.json';
import sepoliaDeployment from './contracts/sepolia.json';
import proofs from './proofs.json';

const AIRDROP_ADDRESS = sepoliaDeployment.TokenAirdrop.address;
const ABI = TokenAirdropABI.abi;

const STATUS_COLORS = {
  claim:    { backgroundColor: '#84cc16', color: '#fff' },
  recover:  { backgroundColor: '#6b0f1a', color: '#fff' },
  update:   { backgroundColor: '#7c3aed', color: '#fff' },
  pause:    { backgroundColor: '#f59e0b', color: '#fff' },
  success:  { backgroundColor: '#22c55e', color: '#fff' },
  error:    { backgroundColor: '#dc2626', color: '#fff' },
  default:  { backgroundColor: '#e0f2fe', color: '#0f4c5c' },
};

const parseError = (err) => {
  if (err.message.includes('user rejected'))           return 'Transaction rejected in MetaMask.';
  if (err.message.includes('insufficient funds'))      return 'Insufficient funds for this transaction.';
  if (err.message.includes('Airdrop has ended'))       return 'The airdrop claim period has ended.';
  if (err.message.includes('Already claimed'))         return 'This wallet has already claimed its airdrop.';
  if (err.message.includes('Invalid merkle proof'))    return 'Invalid merkle proof. You may not be eligible.';
  if (err.message.includes('Amount must be greater'))  return 'Amount must be greater than 0.';
  if (err.message.includes('Airdrop has not ended'))   return 'Airdrop has not ended yet. Cannot recover tokens.';
  if (err.message.includes('No tokens to recover'))    return 'No tokens to recover.';
  if (err.message.includes('Merkle root cannot be zero')) return 'Merkle root cannot be zero.';
  if (err.message.includes('Deadline must be in the future')) return 'Deadline must be in the future.';
  return 'Transaction failed. Please try again.';
};

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: '16px',
      height: '16px',
      border: '2px solid rgba(255,255,255,0.4)',
      borderTop: '2px solid #fff',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      marginRight: '10px',
      verticalAlign: 'middle',
    }} />
  );
}

function App() {
  const [contract,        setContract]        = useState(null);
  const [readContract,    setReadContract]    = useState(null);
  const [account,         setAccount]         = useState(null);
  const [isAdmin,         setIsAdmin]         = useState(false);
  const [isPauser,        setIsPauser]        = useState(false);
  const [isPaused,        setIsPaused]        = useState(false);
  const [contractBalance, setContractBalance] = useState('');
  const [totalClaimed,    setTotalClaimed]    = useState('');
  const [claimDeadline,   setClaimDeadline]   = useState('');
  const [hasClaimed,      setHasClaimed]      = useState(false);
  const [eligible,        setEligible]        = useState(null);
  const [status,          setStatus]          = useState('');
  const [statusStyle,     setStatusStyle]     = useState(STATUS_COLORS.default);
  const [isLoading,       setIsLoading]       = useState(false);
  const [txHash,          setTxHash]          = useState('');

  // Admin state
  const [newMerkleRoot, setNewMerkleRoot] = useState('');
  const [newDeadline,   setNewDeadline]   = useState('');

  // Countdown timer
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!claimDeadline || claimDeadline === '0') return;
    const tick = () => {
      const diff = Number(claimDeadline) - Math.floor(Date.now() / 1000);
      if (diff <= 0) {
        setCountdown('Claim period has ended');
        return;
      }
      const days    = Math.floor(diff / 86400);
      const hours   = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [claimDeadline]);

  const getProofForAccount = (address) => {
    if (!address) return null;
    return proofs[address.toLowerCase()] || null;
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setStatus('MetaMask not found. Please install it.');
        setStatusStyle(STATUS_COLORS.error);
        return;
      }

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      if (chainId !== '0xaa36a7') {
        setStatus('Please switch MetaMask to the Sepolia network.');
        setStatusStyle(STATUS_COLORS.error);
        return;
      }
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      const metaMaskProvider = new ethers.providers.Web3Provider(window.ethereum);
      const _signer  = metaMaskProvider.getSigner();
      const _account = await _signer.getAddress();

      
      const provider = new ethers.providers.JsonRpcProvider(
        process.env.REACT_APP_ALCHEMY_URL,
        { name: 'sepolia', chainId: 11155111 }
      );

      const _contract     = new ethers.Contract(AIRDROP_ADDRESS, ABI, _signer);
      const _readContract = new ethers.Contract(AIRDROP_ADDRESS, ABI, provider);

      setContract(_contract);
      setReadContract(_readContract);
      setAccount(_account);

      await loadDashboardData(_readContract, _account);
    } catch (err) {
      setStatus('Error connecting wallet: ' + err.message);
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountChange = async (accounts) => {
      setStatus('');
      setTxHash('');
      if (accounts.length === 0) {
        setAccount(null);
        setContract(null);
        setReadContract(null);
        setEligible(null);
        setHasClaimed(false);
      } else {
        await connectWallet();
      }
    };
    window.ethereum.on('accountsChanged', handleAccountChange);
    return () => window.ethereum.removeListener('accountsChanged', handleAccountChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboardData = async (_contract, _account) => {
    try {
      const ADMIN_ROLE  = await _contract.ADMIN_ROLE();
      const PAUSER_ROLE = await _contract.PAUSER_ROLE();
      const adminCheck  = await _contract.hasRole(ADMIN_ROLE, _account);
      const pauserCheck = await _contract.hasRole(PAUSER_ROLE, _account);
      const paused      = await _contract.paused();

      setIsAdmin(adminCheck);
      setIsPauser(pauserCheck);
      setIsPaused(paused);

      const balance  = await _contract.getContractBalance();
      const claimed  = await _contract.totalClaimed();
      const deadline = await _contract.claimDeadline();
      const claimed_ = await _contract.hasAddressClaimed(_account);

      setContractBalance(ethers.utils.formatUnits(balance, 18));
      setTotalClaimed(ethers.utils.formatUnits(claimed, 18));
      setClaimDeadline(deadline.toString());
      setHasClaimed(claimed_);

      const entry = getProofForAccount(_account);
      setEligible(entry);
    } catch (err) {
      setStatus('Error loading data: ' + err.message);
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const handleRefresh = async () => {
    if (!readContract || !account) return;
    setStatus('Refreshing...');
    setStatusStyle(STATUS_COLORS.default);
    await loadDashboardData(readContract, account);
    setStatus('');
  };

  const handleClaim = async () => {
    if (!eligible) {
      setStatus('Your wallet is not eligible for this airdrop.');
      setStatusStyle(STATUS_COLORS.error);
      return;
    }
    try {
      setStatus('Claiming airdrop tokens...');
      setStatusStyle(STATUS_COLORS.claim);
      setIsLoading(true);
      const amount = ethers.utils.parseUnits(eligible.amount, 18);
      const proof  = eligible.proof;
      const tx = await contract.claim(amount, proof);
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Airdrop claimed successfully!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readContract, account);
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const handleUpdateMerkleRoot = async () => {
    if (!newMerkleRoot || !newMerkleRoot.startsWith('0x')) {
      setStatus('Please enter a valid Merkle root.');
      setStatusStyle(STATUS_COLORS.error);
      return;
    }
    try {
      setStatus('Updating Merkle root...');
      setStatusStyle(STATUS_COLORS.update);
      setIsLoading(true);
      const tx = await contract.updateMerkleRoot(newMerkleRoot);
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Merkle root updated!');
      setStatusStyle(STATUS_COLORS.success);
      setNewMerkleRoot('');
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const handleUpdateDeadline = async () => {
    if (!newDeadline) {
      setStatus('Please select a new deadline date.');
      setStatusStyle(STATUS_COLORS.error);
      return;
    }
    try {
      setStatus('Updating claim deadline...');
      setStatusStyle(STATUS_COLORS.update);
      setIsLoading(true);
      const [year, month, day] = newDeadline.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      const timestamp = Math.floor(localDate.getTime() / 1000);
      const tx = await contract.updateDeadline(timestamp);
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Claim deadline updated!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readContract, account);
      setNewDeadline('');
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const handlePause = async () => {
    try {
      setStatus(isPaused ? 'Unpausing airdrop...' : 'Pausing airdrop...');
      setStatusStyle(STATUS_COLORS.pause);
      setIsLoading(true);
      const tx = isPaused ? await contract.unpause() : await contract.pause();
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus(isPaused ? 'Airdrop unpaused!' : 'Airdrop paused!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readContract, account);
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const handleRecover = async () => {
    try {
      setStatus('Recovering unclaimed tokens...');
      setStatusStyle(STATUS_COLORS.recover);
      setIsLoading(true);
      const tx = await contract.recoverTokens();
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Tokens recovered successfully!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readContract, account);
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const formatTokens = (amount) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const formatDeadline = (timestamp) => {
    if (!timestamp || timestamp === '0') return 'N/A';
    return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const deadlinePassed = () => {
    if (!claimDeadline || claimDeadline === '0') return false;
    return Date.now() / 1000 > Number(claimDeadline);
  };

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div className="shimmer-bg"></div>
      <div className="content min-h-screen p-8">
        <div className="max-w-5xl mx-auto" style={{ position: 'relative' }}>

          {/* TD LOGO */}
          <img 
              src="/td-logo-justtd.png" 
              alt="Tredway Development" 
              style={{ 
                  position: 'absolute',
                  top: '0',
                  left: '-110px',
                  height: '35px',
              }} 
          />

          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-5xl font-bold tracking-tight" style={{ color: '#0f4c5c' }}>
                Token <span style={{ color: '#7c3aed' }}>Airdrop</span> Dashboard
              </h1>
              <p className="text-sm mt-2 uppercase tracking-widest font-medium" style={{ color: '#64748b' }}>
                Merkle Airdrop Distribution Interface
              </p>
            </div>
            {account && (
              <div className="text-right">
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="text-xs font-mono px-3 py-1 rounded-lg mb-2 transition-all hover:opacity-80"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    color: '#0f4c5c',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    display: 'block',
                    marginLeft: 'auto',
                  }}>
                  ↻ Refresh
                </button>
                <p className="text-xs font-mono" style={{ color: '#64748b' }}>Connected</p>
                <p className="text-sm font-mono font-semibold" style={{ color: '#0f4c5c' }}>
                  {account.slice(0, 6)}...{account.slice(-4)}
                </p>
              </div>
            )}
          </div>
          <hr style={{ borderColor: 'rgba(255,255,255,0.5)', marginBottom: '2rem' }} />

          {/* STATUS BAR */}
          {status && (
            <div className="mb-6 p-4 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
              style={statusStyle}>
              {isLoading && <Spinner />}
              <span>{status}</span>
              {txHash && !isLoading && (
                <a href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: '#fff', textDecoration: 'underline', marginLeft: '8px', fontWeight: 'bold' }}>
                  View on Etherscan ↗
                </a>
              )}
            </div>
          )}

          {!account ? (
            <div className="text-center py-32">
              <div className="mb-6 text-6xl">🪂</div>
              <button onClick={connectWallet}
                className="px-8 py-4 rounded-xl font-semibold text-white text-lg transition-all hover:opacity-90 mb-6 btn-hover"
                style={{ backgroundColor: '#7c3aed' }}>
                Connect Wallet
              </button>
              <p className="text-3xl font-bold mb-3 tracking-tight" style={{ color: '#0f4c5c' }}>
                Connect your wallet to check eligibility
              </p>
              <p className="text-sm uppercase tracking-widest" style={{ color: '#64748b' }}>
                Make sure you're on the Sepolia test network
              </p>
            </div>
          ) : (
            <>
              {/* STATS */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="rounded-2xl p-4 shadow-sm card-hover"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderLeft: '4px solid #0f4c5c',
                  }}>
                  <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>Contract Balance</p>
                  <p className="text-lg font-bold" style={{ color: '#7c3aed' }}>{formatTokens(contractBalance)} tokens</p>
                </div>
                <div className="rounded-2xl p-4 shadow-sm card-hover"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderLeft: '4px solid #0f4c5c',
                  }}>
                  <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>Total Claimed</p>
                  <p className="text-lg font-bold" style={{ color: '#7c3aed' }}>{formatTokens(totalClaimed)} tokens</p>
                </div>
                <div className="rounded-2xl p-4 shadow-sm card-hover"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderLeft: deadlinePassed() ? '4px solid #dc2626' : '4px solid #0f4c5c',
                  }}>
                  <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>Claim Deadline</p>
                  <p className="text-sm font-bold" style={{ color: deadlinePassed() ? '#dc2626' : '#7c3aed' }}>
                    {countdown || 'Loading...'}
                  </p>
                </div>
              </div>

              {/* MY AIRDROP STATUS */}
              <div className="rounded-2xl p-6 mb-8 shadow-sm card-hover"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.6)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.8)',
                  borderLeft: '4px solid #7c3aed',
                }}>
                <h2 className="text-lg font-bold mb-4" style={{ color: '#0f4c5c' }}>My Airdrop Status</h2>

                {!eligible ? (
                  <div className="rounded-xl p-4"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.5)',
                      border: '1px solid rgba(255,255,255,0.8)',
                      borderLeft: '4px solid #dc2626',
                    }}>
                    <p className="text-sm font-semibold" style={{ color: '#dc2626' }}>❌ Not Eligible</p>
                    <p className="text-sm mt-1" style={{ color: '#64748b' }}>
                      This wallet address is not on the airdrop whitelist.
                    </p>
                  </div>
                ) : hasClaimed ? (
                  <div className="rounded-xl p-4"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.5)',
                      border: '1px solid rgba(255,255,255,0.8)',
                      borderLeft: '4px solid #7c3aed',
                    }}>
                    <p className="text-sm font-semibold" style={{ color: '#7c3aed' }}>✓ Airdrop Claimed</p>
                    <p className="text-sm mt-1" style={{ color: '#64748b' }}>
                      You have successfully claimed your <strong>{eligible.amount} STK</strong> tokens.
                    </p>
                  </div>
                ) : deadlinePassed() ? (
                  <div className="rounded-xl p-4"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.5)',
                      border: '1px solid rgba(255,255,255,0.8)',
                      borderLeft: '4px solid #dc2626',
                    }}>
                    <p className="text-sm font-semibold" style={{ color: '#dc2626' }}>⚠️ Claim Period Ended</p>
                    <p className="text-sm mt-1" style={{ color: '#64748b' }}>
                      You were eligible for <strong>{eligible.amount} STK</strong> tokens but the claim deadline has passed.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl p-4"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.5)',
                      border: '1px solid rgba(255,255,255,0.8)',
                      borderLeft: '4px solid #84cc16',
                    }}>
                    <p className="text-sm font-semibold mb-1" style={{ color: '#22c55e' }}>✓ Eligible</p>
                    <p className="text-sm mb-1" style={{ color: '#64748b' }}>
                      Your wallet is eligible to claim <strong style={{ color: '#0f4c5c' }}>{eligible.amount} STK</strong> tokens.
                    </p>
                    <p className="text-xs mb-3" style={{ color: '#64748b' }}>
                      Time remaining: <strong style={{ color: deadlinePassed() ? '#dc2626' : '#0f4c5c' }}>{countdown}</strong>
                    </p>
                    <button
                      onClick={handleClaim}
                      disabled={isLoading || isPaused}
                      className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover"
                      style={{
                        backgroundColor: '#7c3aed',
                        opacity: (isLoading || isPaused) ? 0.5 : 1,
                        cursor:  (isLoading || isPaused) ? 'not-allowed' : 'pointer',
                      }}>
                      Claim {eligible.amount} STK
                    </button>
                    {isPaused && (
                      <p className="text-xs mt-2" style={{ color: '#f59e0b' }}>
                        ⚠️ Airdrop is currently paused. Claims are temporarily disabled.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ADMIN PANEL */}
              {(isAdmin || isPauser) && (
                <div className="rounded-2xl p-6 shadow-sm card-hover"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderLeft: '4px solid #1a5c38',
                  }}>
                  <h2 className="text-xl font-bold mb-6" style={{ color: '#0f4c5c' }}>Admin Panel</h2>

                  {isAdmin && (
                    <>
                      {/* UPDATE MERKLE ROOT */}
                      <p className="text-sm font-semibold mb-2" style={{ color: '#7c3aed' }}>Update Merkle Root</p>
                      <p className="text-xs mb-3" style={{ color: '#64748b' }}>
                        Run generate-merkle.js with your updated whitelist to get a new root.
                      </p>
                      <div className="flex gap-3 mb-8">
                        <input type="text" placeholder="New Merkle root (0x...)"
                          value={newMerkleRoot} onChange={(e) => setNewMerkleRoot(e.target.value)}
                          className="flex-1 border rounded-xl px-4 py-3 text-sm outline-none"
                          style={{ borderColor: '#bae6fd', color: '#334155' }} />
                        <button onClick={handleUpdateMerkleRoot} disabled={isLoading}
                          className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover"
                          style={{
                            backgroundColor: '#7c3aed',
                            opacity: isLoading ? 0.6 : 1,
                            cursor:  isLoading ? 'not-allowed' : 'pointer',
                          }}>
                          Update Root
                        </button>
                      </div>

                      {/* UPDATE DEADLINE */}
                      <hr style={{ borderColor: 'rgba(15,76,92,0.1)', margin: '0 0 24px 0' }} />
                      <p className="text-sm font-semibold mb-2" style={{ color: '#7c3aed' }}>Update Claim Deadline</p>
                      <p className="text-xs mb-3" style={{ color: '#64748b' }}>
                        Current deadline: <strong>{formatDeadline(claimDeadline)}</strong>
                      </p>
                      <div className="flex gap-3 mb-8">
                        <div className="border rounded-xl px-4 py-3 text-sm flex items-center justify-between flex-1"
                          style={{ borderColor: '#bae6fd', backgroundColor: '#fff' }}>
                          <span style={{ color: '#94a3b8', userSelect: 'none' }}>New Deadline</span>
                          <input type="date"
                            value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)}
                            className="outline-none text-sm"
                            style={{ color: '#334155', border: 'none', background: 'transparent', cursor: 'pointer' }} />
                        </div>
                        <button onClick={handleUpdateDeadline} disabled={isLoading}
                          className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover"
                          style={{
                            backgroundColor: '#7c3aed',
                            opacity: isLoading ? 0.6 : 1,
                            cursor:  isLoading ? 'not-allowed' : 'pointer',
                          }}>
                          Update Deadline
                        </button>
                      </div>

                      {/* RECOVER TOKENS */}
                      <hr style={{ borderColor: 'rgba(15,76,92,0.1)', margin: '0 0 24px 0' }} />
                      <p className="text-sm font-semibold mb-2" style={{ color: '#6b0f1a' }}>Recover Unclaimed Tokens</p>
                      <p className="text-xs mb-3" style={{ color: '#64748b' }}>
                        Only available after the claim deadline has passed. Sends all remaining tokens back to admin.
                      </p>
                      <button onClick={handleRecover} disabled={isLoading || !deadlinePassed() || Number(contractBalance) === 0}
                        className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover mb-8"
                        style={{
                          backgroundColor: '#6b0f1a',
                          opacity: (isLoading || !deadlinePassed() || Number(contractBalance) === 0) ? 0.5 : 1,
                          cursor:  (isLoading || !deadlinePassed() || Number(contractBalance) === 0) ? 'not-allowed' : 'pointer',
                        }}>
                        Recover Tokens
                      </button>
                      <hr style={{ borderColor: 'rgba(15,76,92,0.1)', margin: '0 0 24px 0' }} />
                    </>
                  )}

                  {/* PAUSE / UNPAUSE */}
                  {isPauser && (
                    <>
                      <p className="text-sm font-semibold mb-3" style={{ color: '#0f4c5c' }}>
                        Airdrop Status: <span style={{ color: isPaused ? '#dc2626' : '#22c55e' }}>
                          {isPaused ? 'Paused' : 'Active'}
                        </span>
                      </p>
                      <button onClick={handlePause} disabled={isLoading}
                        className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover"
                        style={{
                          backgroundColor: isPaused ? '#22c55e' : '#f59e0b',
                          opacity: isLoading ? 0.6 : 1,
                          cursor:  isLoading ? 'not-allowed' : 'pointer',
                        }}>
                        {isPaused ? 'Unpause Airdrop' : 'Pause Airdrop'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* EMPTY STATE */}
              {!isAdmin && !isPauser && !eligible && (
                <div className="p-4 rounded-xl text-base font-medium text-center"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.4)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderLeft: '4px solid #0f4c5c',
                    color: '#64748b',
                  }}>
                  <span style={{ fontSize: '1.6rem' }}>🔐</span> This wallet is not on the airdrop whitelist.
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;