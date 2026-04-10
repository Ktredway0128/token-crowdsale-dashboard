import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import TokenCrowdsaleABI from './contracts/TokenCrowdsale.json';
import localDeployment from './contracts/sepolia.json';
import proofs from './proofs.json';


const CROWDSALE_ADDRESS = localDeployment.TokenCrowdsale.address;
const ABI = TokenCrowdsaleABI.abi;

const getProofForAddress = (address) => {
  if (!address) return null;
  return proofs[address.toLowerCase()] || null;
};

const isWhitelisted = (address) => {
  if (!address) return false;
  return proofs[address.toLowerCase()] !== undefined;
};


const STATUS_COLORS = {
  buy:      { backgroundColor: '#1d4ed8', color: '#fff' },
  claim:    { backgroundColor: '#1d4ed8', color: '#fff' },
  refund:   { backgroundColor: '#f97316', color: '#fff' },
  admin:    { backgroundColor: '#1d4ed8', color: '#fff' },
  success:  { backgroundColor: '#22c55e', color: '#fff' },
  error:    { backgroundColor: '#dc2626', color: '#fff' },
  default:  { backgroundColor: '#fef3c7', color: '#92400e' },
};

const parseError = (err) => {
  if (err.message.includes('user rejected'))           return 'Transaction rejected in MetaMask.';
  if (err.message.includes('insufficient funds'))      return 'Insufficient funds for this transaction.';
  if (err.message.includes('Not whitelisted'))         return 'Your wallet is not on the whitelist.';
  if (err.message.includes('Below minimum'))           return 'Amount is below the minimum contribution.';
  if (err.message.includes('Exceeds maximum'))         return 'Amount exceeds the maximum contribution.';
  if (err.message.includes('Exceeds hard cap'))        return 'Purchase would exceed the hard cap.';
  if (err.message.includes('Sale has not started'))    return 'The sale has not started yet.';
  if (err.message.includes('Sale has ended'))          return 'The sale has ended.';
  if (err.message.includes('Sale has been finalized')) return 'The sale has been finalized.';
  if (err.message.includes('Soft cap not reached'))    return 'Soft cap not reached. You can claim a refund.';
  if (err.message.includes('Soft cap reached'))        return 'Soft cap was reached. No refunds available.';
  if (err.message.includes('No tokens purchased'))     return 'No tokens purchased for this wallet.';
  if (err.message.includes('No tokens available'))     return 'No tokens available to claim yet.';
  if (err.message.includes('No contribution found'))   return 'No contribution found for this wallet.';
  if (err.message.includes('Refund already claimed'))  return 'Refund has already been claimed.';
  if (err.message.includes('Sale not finalized'))      return 'Sale has not been finalized yet.';
  if (err.message.includes('Sale has not ended'))      return 'Sale has not ended yet.';
  if (err.message.includes('Sale already started'))    return 'Sale has already started.';
  if (err.message.includes('Sale already finalized'))  return 'Sale has already been finalized.';
  if (err.message.includes('Insufficient tokens'))     return 'Insufficient tokens in contract to cover purchase.';
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
  const [isPaused,        setIsPaused]        = useState(false);

  // Sale state
  const [saleStarted,           setSaleStarted]               = useState(false);
  const [saleFinalized,         setSaleFinalized]             = useState(false);
  const [softCapReached,        setSoftCapReached]            = useState(false);
  const [hardCapReached,        setHardCapReached]            = useState(false);
  const [totalRaised,           setTotalRaised]               = useState('0');
  const [totalTokensSold,       setTotalTokensSold]           = useState('0');
  const [hardCap,               setHardCap]                   = useState('0');
  const [softCap,               setSoftCap]                   = useState('0');
  const [tokenPool,             setTokenPool]                 = useState('0');
  const [rate,                  setRate]                      = useState('0');
  const [minContribution,       setMinContribution]           = useState('0');
  const [maxContribution,       setMaxContribution]           = useState('0');
  const [saleEnd,               setSaleEnd]                   = useState('0');
  const [vestingDuration,       setVestingDuration]           = useState('0');
  const [cliffDuration,         setCliffDuration]             = useState('0');
  const [currentBlockTimestamp, setCurrentBlockTimestamp]     = useState(0);
  const [saleDuration,          setSaleDuration]              = useState('0');



  // User state
  const [myContribution,    setMyContribution]       = useState('0');
  const [myTokensPurchased, setMyTokensPurchased]    = useState('0');
  const [myClaimable,       setMyClaimable]          = useState('0');
  const [myRefundAmount,    setMyRefundAmount]       = useState('0');
  const [refundClaimed,     setRefundClaimed]        = useState(false);
  const [whitelisted,       setWhitelisted]          = useState(false);
  const [myTokensClaimed,   setMyTokensClaimed]      = useState('0');
  const [recoverToken,      setRecoverToken]         = useState('');
  const [recoverAmount,     setRecoverAmount]        = useState('');




  // User inputs
  const [buyAmount,         setBuyAmount]           = useState('');

  // Status
  const [status,            setStatus]              = useState('');
  const [statusStyle,       setStatusStyle]         = useState(STATUS_COLORS.default);
  const [isLoading,         setIsLoading]           = useState(false);
  const [txHash,            setTxHash]              = useState('');

  // Countdown
  const [countdown,         setCountdown]           = useState('');

  useEffect(() => {
    if (!saleEnd || saleEnd === '0') return;
    const tick = () => {
      const diff = Number(saleEnd) - Math.floor(Date.now() / 1000);
      if (diff <= 0) {
        setCountdown('Sale has ended');
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
  }, [saleEnd]);

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setStatus('MetaMask not found. Please install it.');
        setStatusStyle(STATUS_COLORS.error);
        return;
      }

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0x7a69') {
        setStatus('Please switch MetaMask to Hardhat localhost network.');
        setStatusStyle(STATUS_COLORS.error);
        return;
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });

      const metaMaskProvider = new ethers.providers.Web3Provider(window.ethereum);
      const _signer  = metaMaskProvider.getSigner();
      const _account = await _signer.getAddress();

      const localProvider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');

      const _contract     = new ethers.Contract(CROWDSALE_ADDRESS, ABI, _signer);
      const _readContract = new ethers.Contract(CROWDSALE_ADDRESS, ABI, localProvider);

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
        setMyContribution('0');
        setMyTokensPurchased('0');
        setMyClaimable('0');
        setMyRefundAmount('0');
        setWhitelisted(false);
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
      const ADMIN_ROLE = await _contract.ADMIN_ROLE();
      const adminCheck = await _contract.hasRole(ADMIN_ROLE, _account);
      const paused     = await _contract.paused();

      setIsAdmin(adminCheck);
      setIsPaused(paused);

      const _saleStarted     = await _contract.saleStarted();
      const _saleFinalized   = await _contract.saleFinalized();
      const _softCapReached  = await _contract.softCapReached();
      const _hardCapReached  = await _contract.hardCapReached();
      const _totalRaised     = await _contract.totalRaised();
      const _totalTokensSold = await _contract.totalTokensSold();
      const _hardCap         = await _contract.hardCap();
      const _softCap         = await _contract.softCap();
      const _tokenPool       = await _contract.tokenBalance();
      const _rate            = await _contract.rate();
      const _minContribution = await _contract.minContribution();
      const _maxContribution = await _contract.maxContribution();
      const _saleEnd         = await _contract.saleEnd();
      const _vestingDuration = await _contract.vestingDuration();
      const _cliffDuration   = await _contract.cliffDuration();
      const block            = await _contract.provider.getBlock('latest');
      const _saleDuration    = await _contract.saleDuration();



      setSaleStarted(_saleStarted);
      setSaleFinalized(_saleFinalized);
      setSoftCapReached(_softCapReached);
      setHardCapReached(_hardCapReached);
      setTotalRaised(ethers.utils.formatEther(_totalRaised));
      setTotalTokensSold(ethers.utils.formatUnits(_totalTokensSold, 18));
      setHardCap(ethers.utils.formatEther(_hardCap));
      setSoftCap(ethers.utils.formatEther(_softCap));
      setTokenPool(ethers.utils.formatUnits(_tokenPool, 18));
      setRate(_rate.toString());
      setMinContribution(ethers.utils.formatEther(_minContribution));
      setMaxContribution(ethers.utils.formatEther(_maxContribution));
      setSaleEnd(_saleEnd.toString());
      setVestingDuration(_vestingDuration.toString());
      setCliffDuration(_cliffDuration.toString());
      setCurrentBlockTimestamp(block.timestamp);
      setSaleDuration(_saleDuration.toString());


      const _myContribution    = await _contract.contributions(_account);
      const _myTokensPurchased = await _contract.tokensPurchased(_account);
      const _myClaimable       = await _contract.getClaimableAmount(_account);
      const _myRefundAmount    = await _contract.getRefundAmount(_account);
      const _myTokensClaimed = await _contract.tokensClaimed(_account);
      const _refundClaimed     = await _contract.refundClaimed(_account);
      

      setMyContribution(ethers.utils.formatEther(_myContribution));
      setMyTokensPurchased(ethers.utils.formatUnits(_myTokensPurchased, 18));
      setMyClaimable(ethers.utils.formatUnits(_myClaimable, 18));
      setMyRefundAmount(ethers.utils.formatEther(_myRefundAmount));
      setMyTokensClaimed(ethers.utils.formatUnits(_myTokensClaimed, 18));
      setRefundClaimed(_refundClaimed);
      setWhitelisted(isWhitelisted(_account));

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

  // ===== USER FUNCTIONS =====

  const handleBuyTokens = async () => {
    if (!buyAmount || Number(buyAmount) <= 0) {
      setStatus('Please enter a valid ETH amount.');
      setStatusStyle(STATUS_COLORS.error);
      return;
    }
    try {
      setStatus('Purchasing tokens...');
      setStatusStyle(STATUS_COLORS.buy);
      setIsLoading(true);

      const proof = getProofForAddress(account);
      if (!proof) {
        setStatus('Your wallet is not on the whitelist.');
        setStatusStyle(STATUS_COLORS.error);
        setIsLoading(false);
        return;
      }

      const ethAmount = ethers.utils.parseEther(buyAmount);
      const tx = await contract.buyTokens(proof, { value: ethAmount });
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Tokens purchased successfully!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readContract, account);
      setBuyAmount('');
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const handleClaimTokens = async () => {
    try {
      setStatus('Claiming tokens...');
      setStatusStyle(STATUS_COLORS.claim);
      setIsLoading(true);
      const tx = await contract.claimTokens();
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Tokens claimed successfully!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readContract, account);
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const handleClaimRefund = async () => {
    try {
      setStatus('Claiming refund...');
      setStatusStyle(STATUS_COLORS.refund);
      setIsLoading(true);
      const tx = await contract.claimRefund();
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Refund claimed successfully!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readContract, account);
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  // ===== ADMIN FUNCTIONS =====

  const handleStartSale = async () => {
    try {
      setStatus('Starting sale...');
      setStatusStyle(STATUS_COLORS.admin);
      setIsLoading(true);
      const tx = await contract.startSale();
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Sale started successfully!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readContract, account);
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const handleFinalizeSale = async () => {
    try {
      setStatus('Finalizing sale...');
      setStatusStyle(STATUS_COLORS.admin);
      setIsLoading(true);
      const tx = await contract.finalizeSale();
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Sale finalized successfully!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readContract, account);
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const handlePause = async () => {
    try {
      setStatus(isPaused ? 'Unpausing...' : 'Pausing...');
      setStatusStyle(STATUS_COLORS.admin);
      setIsLoading(true);
      const tx = isPaused ? await contract.unpause() : await contract.pause();
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus(isPaused ? 'Sale unpaused!' : 'Sale paused!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readContract, account);
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const handleRecoverTokens = async () => {
    if (!recoverToken || !recoverAmount || Number(recoverAmount) <= 0) {
      setStatus('Please enter a valid token address and amount.');
      setStatusStyle(STATUS_COLORS.error);
      return;
    }
    try {
      setStatus('Recovering tokens...');
      setStatusStyle(STATUS_COLORS.admin);
      setIsLoading(true);
      const tx = await contract.recoverTokens(
        recoverToken,
        ethers.utils.parseUnits(recoverAmount, 18)
      );
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Tokens recovered successfully!');
      setStatusStyle(STATUS_COLORS.success);
      setRecoverToken('');
      setRecoverAmount('');
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const formatTokens = (amount) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });

  const formatETH = (amount) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });

  const formatDate = (timestamp) => {
    if (!timestamp || timestamp === '0') return 'Not set';
    return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds === '0') return 'Not set';
    const days = Math.floor(Number(seconds) / 86400);
    return `${days} days`;
  };

  const saleIsActive = () => {
    return saleStarted && !saleFinalized && Number(saleEnd) > currentBlockTimestamp;
};

  const progressPct = () => {
    if (!hardCap || hardCap === '0') return 0;
    return Math.min(100, (Number(totalRaised) / Number(hardCap)) * 100);
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
                Token <span style={{ color: '#1d4ed8' }}>Crowdsale</span> Dashboard
              </h1>
              <p className="text-sm mt-2 uppercase tracking-widest font-medium" style={{ color: '#64748b' }}>
                Token Sale & Distribution Interface
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
                <a href={`http://localhost:8545`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: '#fff', textDecoration: 'underline', marginLeft: '8px', fontWeight: 'bold' }}>
                  Transaction Confirmed ↗
                </a>
              )}
            </div>
          )}

          {!account ? (
            <div className="text-center py-32">
              <div className="mb-6 text-6xl">🚀</div>
              <button onClick={connectWallet}
                className="px-8 py-4 rounded-xl font-semibold text-white text-lg transition-all hover:opacity-90 mb-6 btn-hover"
                style={{ backgroundColor: '#1d4ed8' }}>
                Connect Wallet
              </button>
              <p className="text-3xl font-bold mb-3 tracking-tight" style={{ color: '#0f4c5c' }}>
                Connect your wallet to participate in the token sale
              </p>
              <p className="text-sm uppercase tracking-widest" style={{ color: '#64748b' }}>
                Make sure you're on the Hardhat localhost network
              </p>
            </div>
          ) : (
            <>
              {/* STATS CARDS */}
              <div className="grid grid-cols-5 gap-3 mb-8">
                {[
                  { label: 'Total Raised',      value: formatETH(totalRaised) + ' ETH' },
                  { label: 'Cap',               value: formatETH(softCap) + ' / ' + formatETH(hardCap) + ' ETH' },
                  { label: 'Token Pool',        value: formatTokens(tokenPool) + ' STK' },
                  { label: 'Total Tokens Sold', value: formatTokens(totalTokensSold) + ' STK' },
                  { label: 'My Tokens',         value: formatTokens(myTokensPurchased) + ' STK' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl p-4 shadow-sm card-hover"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.6)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.8)',
                      borderLeft: '4px solid #0f4c5c',
                    }}>
                    <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>{stat.label}</p>
                    <p className="text-lg font-bold" style={{ color: '#1d4ed8' }}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* SALE PROGRESS */}
              <div className="rounded-2xl p-6 mb-8 shadow-sm card-hover"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.6)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.8)',
                  borderLeft: '4px solid #1d4ed8',
                }}>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>Sale Status</p>
                    <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>
                      {!saleStarted ? (
                        <span style={{ color: '#64748b' }}>● Not Started</span>
                      ) : saleFinalized ? (
                        <span style={{ color: '#64748b' }}>● Finalized</span>
                      ) : saleIsActive() ? (
                        <span style={{ color: '#22c55e' }}>● Active — {countdown}</span>
                      ) : (
                        <span style={{ color: '#dc2626' }}>● Ended</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>End Date</p>
                    <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatDate(saleEnd)}</p>
                  </div>
                </div>

                {/* PROGRESS BAR */}
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Raise Progress</p>
                    <p className="text-xs font-semibold" style={{ color: '#0f4c5c' }}>{progressPct().toFixed(1)}%</p>
                  </div>
                  <div style={{
                    height: '8px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(15,76,92,0.12)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${progressPct()}%`,
                      borderRadius: '9999px',
                      background: 'linear-gradient(90deg, #1d4ed8, #f59e0b)',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
                
                {!saleIsActive() && saleStarted && !saleFinalized && Number(totalRaised) < Number(softCap) && (
                  <p className="text-xs mt-2" style={{ color: '#dc2626' }}>
                    ⚠️ Soft cap was not reached. Finalizing will enable refunds for all buyers.
                  </p>
                )}

                <div className="flex gap-6 mt-3">
                  <p className="text-xs" style={{ color: '#64748b' }}>
                    Soft Cap: <strong style={{ color: Number(totalRaised) >= Number(softCap) ? '#22c55e' : '#0f4c5c' }}>
                      {Number(totalRaised) >= Number(softCap) ? '✓ Reached' : formatETH(softCap) + ' ETH'}
                    </strong>
                  </p>
                  <p className="text-xs" style={{ color: '#64748b' }}>
                    Hard Cap: <strong style={{ color: hardCapReached ? '#22c55e' : '#0f4c5c' }}>
                      {hardCapReached ? '✓ Reached' : formatETH(hardCap) + ' ETH'}
                    </strong>
                  </p>
                  <p className="text-xs" style={{ color: '#64748b' }}>
                    Rate: <strong style={{ color: '#0f4c5c' }}>{rate} STK per ETH</strong>
                  </p>
                </div>
              </div>

              {/* SALE DETAILS */}
              <div className="rounded-2xl p-4 mb-8 shadow-sm card-hover"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.6)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.8)',
                  borderLeft: '4px solid #1d4ed8',
                }}>
                <div className="grid grid-cols-5 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>Sale Duration</p>
                    <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatDuration(saleDuration)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>Min Contribution</p>
                    <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatETH(minContribution)} ETH</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>Max Contribution</p>
                    <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatETH(maxContribution)} ETH</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>Cliff Period</p>
                    <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatDuration(cliffDuration)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>Vesting Duration</p>
                    <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatDuration(vestingDuration)}</p>
                  </div>
                </div>
              </div>

              {/* BUY TOKENS */}
              {saleIsActive() && whitelisted && (
                <div className="rounded-2xl p-6 mb-8 shadow-sm card-hover"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderLeft: '4px solid #1d4ed8',
                  }}>
                  <h2 className="text-lg font-bold mb-2" style={{ color: '#0f4c5c' }}>Buy Tokens</h2>
                  <p className="text-xs mb-4" style={{ color: '#64748b' }}>
                    Enter ETH amount. You will receive <strong style={{ color: '#1d4ed8' }}>{rate} STK per ETH</strong>.
                    Min: {formatETH(minContribution)} ETH — Max: {formatETH(maxContribution)} ETH
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      placeholder="ETH amount"
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value)}
                      className="flex-1 border rounded-xl px-4 py-3 text-sm outline-none"
                      style={{ borderColor: '#bae6fd', color: '#334155' }}
                    />
                    <button
                      onClick={handleBuyTokens}
                      disabled={isLoading || isPaused}
                      className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover"
                      style={{
                        backgroundColor: '#1d4ed8',
                        opacity: (isLoading || isPaused) ? 0.6 : 1,
                        cursor: (isLoading || isPaused) ? 'not-allowed' : 'pointer',
                      }}>
                      Buy Tokens
                    </button>
                  </div>
                  {isPaused && (
                    <p className="text-xs mt-2" style={{ color: '#f97316' }}>
                      ⚠️ Sale is currently paused.
                    </p>
                  )}
                </div>
              )}

              {/* NOT WHITELISTED */}
              {saleIsActive() && !whitelisted && (
                <div className="rounded-2xl p-4 mb-8 shadow-sm"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderLeft: '4px solid #dc2626',
                  }}>
                  <p className="text-sm font-semibold" style={{ color: '#dc2626' }}>❌ Not Whitelisted</p>
                  <p className="text-sm mt-1" style={{ color: '#64748b' }}>
                    This wallet is not on the whitelist and cannot participate in the sale.
                  </p>
                </div>
              )}

              {/* MY POSITION */}
              {Number(myTokensPurchased) > 0 && (
                <div className="rounded-2xl p-6 mb-8 shadow-sm card-hover"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderLeft: '4px solid #1d4ed8',
                  }}>
                  <h2 className="text-lg font-bold mb-4" style={{ color: '#0f4c5c' }}>My Position</h2>

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>My Contribution</p>
                      <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatETH(myContribution)} ETH</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Tokens Purchased</p>
                      <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatTokens(myTokensPurchased)} STK</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Tokens Claimed</p>
                      <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatTokens(myTokensClaimed)} STK</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Claimable Now</p>
                      <p className="text-sm font-bold" style={{ color: '#1d4ed8' }}>{formatTokens(myClaimable)} STK</p>
                    </div>
                  </div>

                  <div className="rounded-xl p-3 mb-4"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.4)',
                      border: '1px solid rgba(255,255,255,0.6)',
                    }}>
                    <p className="text-xs" style={{ color: '#64748b' }}>
                      Your tokens vest over <strong style={{ color: '#0f4c5c' }}>{formatDuration(vestingDuration)}</strong> with 
                      a <strong style={{ color: '#0f4c5c' }}>{formatDuration(cliffDuration)}</strong> cliff from your purchase date. 
                      No tokens are claimable until the cliff expires. After the cliff, tokens release linearly until fully vested.
                    </p>
                  </div>

                  {saleFinalized && !softCapReached && Number(myContribution) > 0 && !refundClaimed && (
                    <p className="text-sm" style={{ color: '#f97316' }}>
                      ⚠️ Soft cap was not reached. You are eligible for a full refund of your ETH contribution.
                    </p>
                  )}

                  {/* CLAIM TOKENS */}
                  {saleFinalized && softCapReached && Number(myClaimable) > 0 && (
                    <button
                      onClick={handleClaimTokens}
                      disabled={isLoading}
                      className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover mr-3"
                      style={{
                        backgroundColor: '#1d4ed8',
                        opacity: isLoading ? 0.6 : 1,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                      }}>
                      Claim Tokens
                    </button>
                  )}

                  {/* CLAIM REFUND */}
                  {saleFinalized && !softCapReached && Number(myRefundAmount) > 0 && !refundClaimed && (
                    <button
                      onClick={handleClaimRefund}
                      disabled={isLoading}
                      className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover"
                      style={{
                        backgroundColor: '#f97316',
                        opacity: isLoading ? 0.6 : 1,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                      }}>
                      Claim Refund — {formatETH(myRefundAmount)} ETH
                    </button>
                  )}

                  {saleFinalized && !softCapReached && refundClaimed && (
                    <p className="text-sm font-semibold" style={{ color: '#64748b' }}>✓ Refund claimed</p>
                  )}

                  {saleFinalized && softCapReached && Number(myClaimable) === 0 && Number(myTokensClaimed) === 0 && (
                    <p className="text-sm" style={{ color: '#64748b' }}>
                      No tokens claimable yet — cliff period has not passed.
                    </p>
                  )}

                  {saleFinalized && softCapReached && Number(myClaimable) === 0 && Number(myTokensClaimed) > 0 && (
                    <p className="text-sm" style={{ color: '#64748b' }}>
                      Check back as more tokens vest over time.
                    </p>
                  )}

                  {!saleFinalized && (
                    <p className="text-sm" style={{ color: '#64748b' }}>
                      Tokens will be claimable after the sale is finalized and your cliff period expires.
                    </p>
                  )}
                </div>
              )}

              {/* ADMIN PANEL */}
              {isAdmin && (
                <div className="rounded-2xl p-6 shadow-sm card-hover"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderLeft: '4px solid #1a5c38',
                  }}>
                  <h2 className="text-xl font-bold mb-6" style={{ color: '#0f4c5c' }}>Admin Panel</h2>

                  {/* RECOVER TOKENS */}
                  <hr style={{ borderColor: 'rgba(15,76,92,0.1)', margin: '0 0 24px 0' }} />
                  <p className="text-sm font-semibold mb-2" style={{ color: '#dc2626' }}>Recover Accidentally Sent Tokens</p>
                  <p className="text-xs mb-3" style={{ color: '#64748b' }}>
                    Cannot recover the sale token. Emergency use only.
                  </p>
                  <div className="flex gap-3 mb-8">
                    <input
                      type="text"
                      placeholder="Token contract address (0x...)"
                      value={recoverToken}
                      onChange={(e) => setRecoverToken(e.target.value)}
                      className="flex-1 border rounded-xl px-4 py-3 text-sm outline-none"
                      style={{ borderColor: '#bae6fd', color: '#334155' }}
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={recoverAmount}
                      onChange={(e) => setRecoverAmount(e.target.value)}
                      className="w-36 border rounded-xl px-4 py-3 text-sm outline-none"
                      style={{ borderColor: '#bae6fd', color: '#334155' }}
                    />
                    <button
                      onClick={handleRecoverTokens}
                      disabled={isLoading}
                      className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover"
                      style={{
                        backgroundColor: '#dc2626',
                        opacity: isLoading ? 0.6 : 1,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                      }}>
                      Recover
                    </button>
                  </div>
                  <hr style={{ borderColor: 'rgba(15,76,92,0.1)', margin: '0 0 24px 0' }} />

                  {/* START SALE */}
                  {!saleStarted && (
                    <>
                      <p className="text-sm font-semibold mb-2" style={{ color: '#1d4ed8' }}>Start Sale</p>
                      <p className="text-xs mb-3" style={{ color: '#64748b' }}>
                        Starts the token sale. Contract must be funded with enough tokens to cover the hard cap.
                      </p>
                      <button
                        onClick={handleStartSale}
                        disabled={isLoading}
                        className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover mb-8"
                        style={{
                          backgroundColor: '#1d4ed8',
                          opacity: isLoading ? 0.6 : 1,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                        }}>
                        Start Sale
                      </button>
                      <hr style={{ borderColor: 'rgba(15,76,92,0.1)', margin: '0 0 24px 0' }} />
                    </>
                  )}

                  {/* FINALIZE SALE */}
                  {saleStarted && !saleFinalized && Number(saleEnd) <= currentBlockTimestamp && (
                    <>
                      <p className="text-sm font-semibold mb-2" style={{ color: '#1d4ed8' }}>Finalize Sale</p>
                      <p className="text-xs mb-3" style={{ color: '#64748b' }}>
                        Finalizes the sale. If soft cap was reached ETH is sent to admin. If not buyers can claim refunds.
                      </p>
                      <button
                        onClick={handleFinalizeSale}
                        disabled={isLoading}
                        className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover mb-8"
                        style={{
                          backgroundColor: '#1d4ed8',
                          opacity: isLoading ? 0.6 : 1,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                        }}>
                        Finalize Sale
                      </button>
                      <hr style={{ borderColor: 'rgba(15,76,92,0.1)', margin: '0 0 24px 0' }} />
                    </>
                  )}

                  {/* PAUSE / UNPAUSE */}
                  <p className="text-sm font-semibold mb-3" style={{ color: '#0f4c5c' }}>
                    Sale Status: <span style={{ color: isPaused ? '#dc2626' : '#22c55e' }}>
                      {isPaused ? 'Paused' : 'Active'}
                    </span>
                  </p>
                  <button
                    onClick={handlePause}
                    disabled={isLoading}
                    className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover"
                    style={{
                      backgroundColor: isPaused ? '#22c55e' : '#f97316',
                      opacity: isLoading ? 0.6 : 1,
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                    }}>
                    {isPaused ? 'Unpause Sale' : 'Pause Sale'}
                  </button>

                </div>
              )}

              {/* EMPTY STATE */}
              {!isAdmin && !whitelisted && Number(myTokensPurchased) === 0 && (
                <div className="p-4 rounded-xl text-base font-medium text-center"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.4)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderLeft: '4px solid #1d4ed8',
                    color: '#64748b',
                  }}>
                  <span style={{ fontSize: '1.6rem' }}>🚀</span> This wallet is not on the whitelist for this token sale.
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