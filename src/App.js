import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import TokenVestingABI from './contracts/TokenVesting.json';
import sepoliaDeployment from './contracts/sepolia.json';

const VESTING_ADDRESS = sepoliaDeployment.TokenVesting.address;
const ABI = TokenVestingABI.abi;

const STATUS_COLORS = {
  create:   { backgroundColor: '#3b82f6', color: '#fff' },
  release:  { backgroundColor: '#84cc16', color: '#fff' },
  revoke:   { backgroundColor: '#6b0f1a', color: '#fff' },
  withdraw: { backgroundColor: '#84cc16', color: '#fff' },
  success:  { backgroundColor: '#22c55e', color: '#fff' },
  error:    { backgroundColor: '#dc2626', color: '#fff' },
  default:  { backgroundColor: '#e0f2fe', color: '#0f4c5c' },
};

const parseError = (err) => {
  if (err.message.includes('user rejected'))       return 'Transaction rejected in MetaMask.';
  if (err.message.includes('insufficient funds'))  return 'Insufficient funds for this transaction.';
  if (err.message.includes('Not enough tokens'))   return 'Not enough tokens in contract to create schedule.';
  if (err.message.includes('Only beneficiary'))    return 'Only the beneficiary can release tokens.';
  if (err.message.includes('No tokens available')) return 'No tokens available to release yet.';
  if (err.message.includes('Already revoked'))     return 'This vesting schedule has already been revoked.';
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

function VestingProgressBar({ released, totalAmount }) {
  const releasedNum = Number(ethers.utils.formatUnits(released, 18));
  const totalNum    = Number(ethers.utils.formatUnits(totalAmount, 18));
  const pct = totalNum > 0 ? Math.min(100, (releasedNum / totalNum) * 100) : 0;
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Claimed Progress</p>
        <p className="text-xs font-semibold" style={{ color: '#0f4c5c' }}>{pct.toFixed(1)}%</p>
      </div>
      <div style={{
        height: '8px',
        borderRadius: '9999px',
        backgroundColor: 'rgba(15,76,92,0.12)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: '9999px',
          background: 'linear-gradient(90deg, #0f4c5c, #84cc16)',
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  );
}

function App() {
  const [contract,      setContract]      = useState(null);
  const [readContract,  setReadContract]  = useState(null);
  const [account,       setAccount]       = useState(null);
  const [isAdmin,       setIsAdmin]       = useState(false);
  const [withdrawable,  setWithdrawable]  = useState('');
  const [totalLocked,   setTotalLocked]   = useState('');
  const [scheduleCount, setScheduleCount] = useState(0);
  const [mySchedules,   setMySchedules]   = useState([]);
  const [status,        setStatus]        = useState('');
  const [statusStyle,   setStatusStyle]   = useState(STATUS_COLORS.default);
  const [isLoading,     setIsLoading]     = useState(false);
  const [txHash,        setTxHash]        = useState('');

  // Create schedule form
  const [createBeneficiary, setCreateBeneficiary] = useState('');
  const [createAmount,      setCreateAmount]      = useState('');
  const [createStart,       setCreateStart]       = useState('');
  const [createCliff,       setCreateCliff]       = useState('');
  const [createDuration,    setCreateDuration]    = useState('');

  // Admin withdraw
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Frozen releasable amounts captured from revoke tx receipt
  const [revokedAmounts, setRevokedAmounts] = useState({});

  // Admin lookup
  const [lookupAddress, setLookupAddress]     = useState('');
  const [lookupSchedules, setLookupSchedules] = useState([]);
  const [lookupLoading, setLookupLoading]     = useState(false);
  const [lookupError, setLookupError]         = useState('');

  const handleLookup = async () => {
    if (!lookupAddress) {
      setLookupError('Please enter a wallet address.');
      return;
    }
    try {
      setLookupLoading(true);
      setLookupError('');
      setLookupSchedules([]);
      const holderCount = await readContract.holdersVestingCount(lookupAddress);
      const schedules = [];
      for (let i = 0; i < holderCount.toNumber(); i++) {
        const vestingId  = await readContract.getVestingIdAtIndex(lookupAddress, i);
        const schedule   = await readContract.getVestingSchedule(vestingId);
        const releasable = await readContract.computeReleasableAmount(schedule);
        // If revoked, get the exact releasable at the block revocation happened
        let revokedReleasable = null;
        if (schedule.revoked) {
          try {
            // Find the revoke tx block by scanning recent blocks for VestingRevoked topic
            const revokeFilter = {
              address: VESTING_ADDRESS,
              topics: [ethers.utils.id('VestingRevoked(bytes32,address,uint256)')],
              fromBlock: -10000, // last 10000 blocks
              toBlock: 'latest',
            };
            const provider = readContract.provider;
            const logs = await provider.getLogs(revokeFilter);
            const iface = new ethers.utils.Interface([
              'event VestingRevoked(bytes32 vestingId, address beneficiary, uint256 returnedAmount)'
            ]);
            const matchingLog = logs
              .map(log => { try { return { ...iface.parseLog(log), blockNumber: log.blockNumber }; } catch { return null; } })
              .filter(Boolean)
              .find(e => e.args.vestingId === vestingId);

            if (matchingLog) {
              const blockTag = matchingLog.blockNumber - 1;
              const contractAtBlock = readContract.attach(readContract.address);
              const releasableAtRevoke = await contractAtBlock.computeReleasableAmount(schedule, { blockTag });
              revokedReleasable = releasableAtRevoke;
            }
          } catch (e) {
            revokedReleasable = schedule.totalAmount.sub(schedule.released);
          }
        }

        schedules.push({ vestingId, schedule, releasable, revokedReleasable });
      }
      if (schedules.length === 0) {
        setLookupError('No vesting schedules found for this address.');
      }
      setLookupSchedules(schedules);
      setLookupLoading(false);
    } catch (err) {
      setLookupLoading(false);
      setLookupError('Error loading schedules: ' + err.message);
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setStatus('MetaMask not found. Please install it.');
        setStatusStyle(STATUS_COLORS.error);
        return;
      }

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      // 0x7a69 = Hardhat localhost (31337) | 0xaa36a7 = Sepolia
      // Switch back to '0xaa36a7' and 'Sepolia' when deploying to testnet
      if (chainId !== '0x7a69') {
        setStatus('Please switch MetaMask to the Hardhat localhost network.');
        setStatusStyle(STATUS_COLORS.error);
        return;
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });

      const metaMaskProvider = new ethers.providers.Web3Provider(window.ethereum);
      const _signer  = metaMaskProvider.getSigner();
      const _account = await _signer.getAddress();

      // Hardhat local node — switch back to Alchemy URL for Sepolia deployment
      const alchemyProvider = new ethers.providers.JsonRpcProvider(
        'http://127.0.0.1:8545',
        { name: 'hardhat', chainId: 31337 }
      );

      const _contract     = new ethers.Contract(VESTING_ADDRESS, ABI, _signer);
      const _readContract = new ethers.Contract(VESTING_ADDRESS, ABI, alchemyProvider);

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
      // Always clear status and txHash when switching accounts
      setStatus('');
      setTxHash('');
      if (accounts.length === 0) {
        setAccount(null);
        setContract(null);
        setReadContract(null);
        setMySchedules([]);
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
      const adminCheck  = await _contract.hasRole(ADMIN_ROLE, _account);
      setIsAdmin(adminCheck);

      const withdrawableAmt = await _contract.getWithdrawableAmount();
      const totalLockedAmt  = await _contract.vestingSchedulesTotalAmount();
      const activeCount = await _contract.activeSchedulesCount();

      setWithdrawable(ethers.utils.formatUnits(withdrawableAmt, 18));
      setTotalLocked(ethers.utils.formatUnits(totalLockedAmt, 18));
      setScheduleCount(activeCount.toString());

      const holderCount = await _contract.holdersVestingCount(_account);
      const schedules   = [];
      for (let i = 0; i < holderCount.toNumber(); i++) {
        const vestingId  = await _contract.getVestingIdAtIndex(_account, i);
        const schedule   = await _contract.getVestingSchedule(vestingId);
        const releasable = await _contract.computeReleasableAmount(schedule);

        // If revoked, get the exact releasable at the block revocation happened
        let revokedReleasable = null;
        if (schedule.revoked) {
          try {
            // Find the revoke tx block by scanning recent blocks for VestingRevoked topic
            const revokeFilter = {
              address: VESTING_ADDRESS,
              topics: [ethers.utils.id('VestingRevoked(bytes32,address,uint256)')],
              fromBlock: -10000, // last 10000 blocks
              toBlock: 'latest',
            };
            const provider = _contract.provider;
            const logs = await provider.getLogs(revokeFilter);
            const iface = new ethers.utils.Interface([
              'event VestingRevoked(bytes32 vestingId, address beneficiary, uint256 returnedAmount)'
            ]);
            const matchingLog = logs
              .map(log => { try { return { ...iface.parseLog(log), blockNumber: log.blockNumber }; } catch { return null; } })
              .filter(Boolean)
              .find(e => e.args.vestingId === vestingId);

            if (matchingLog) {
              const blockTag = matchingLog.blockNumber - 1;
              const contractAtBlock = _contract.attach(_contract.address);
              const releasableAtRevoke = await contractAtBlock.computeReleasableAmount(schedule, { blockTag });
              revokedReleasable = releasableAtRevoke;
            }
          } catch (e) {
            revokedReleasable = schedule.totalAmount.sub(schedule.released);
          }
        }

        schedules.push({ vestingId, schedule, releasable, revokedReleasable });
      }
      setMySchedules(schedules);
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

  const handleCreateSchedule = async () => {
    if (!createBeneficiary || !createAmount || !createStart || !createCliff || !createDuration) {
      setStatus('Please fill in all fields.');
      setStatusStyle(STATUS_COLORS.error);
      return;
    }
    try {
      setStatus('Creating vesting schedule...');
      setStatusStyle(STATUS_COLORS.create);
      setIsLoading(true);

      // ABI expects uint64 — pass as plain numbers
      // Parse date as local time (not UTC) to avoid timezone shift
      const [year, month, day] = createStart.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      const startTimestamp = Math.floor(localDate.getTime() / 1000);
      const cliffSeconds    = Number(createCliff)    * 86400;
      const durationSeconds = Number(createDuration) * 86400;

      const tx = await contract.createVestingSchedule(
        createBeneficiary,
        ethers.utils.parseUnits(createAmount, 18),
        startTimestamp,
        cliffSeconds,
        durationSeconds
      );
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Vesting schedule created!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readContract, account);
      setCreateBeneficiary('');
      setCreateAmount('');
      setCreateStart('');
      setCreateCliff('');
      setCreateDuration('');
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const handleRelease = async (vestingId) => {
    try {
      setStatus('Releasing tokens...');
      setStatusStyle(STATUS_COLORS.release);
      setIsLoading(true);
      const tx = await contract.release(vestingId);
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Tokens released successfully!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readContract, account);
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const handleRevoke = async (vestingId) => {
    try {
      setStatus('Revoking vesting schedule...');
      setStatusStyle(STATUS_COLORS.revoke);
      setIsLoading(true);
      const tx = await contract.revoke(vestingId);
      const receipt = await tx.wait();
      // Parse VestingRevoked event directly from the receipt — no log range limits
      const iface = new ethers.utils.Interface([
        'event VestingRevoked(bytes32 vestingId, address beneficiary, uint256 returnedAmount)'
      ]);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed.name === 'VestingRevoked' && parsed.args.vestingId === vestingId) {
            // totalAmount - returnedAmount = vested at revocation
            // We store this keyed by vestingId so the display can use it
            const schedule = await readContract.getVestingSchedule(vestingId);
            const vestedAtRevoke = schedule.totalAmount.sub(parsed.args.returnedAmount).sub(schedule.released);
            setRevokedAmounts(prev => ({
              ...prev,
              [vestingId]: vestedAtRevoke.isNegative() ? ethers.BigNumber.from(0) : vestedAtRevoke,
            }));
            break;
          }
        } catch {}
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Vesting schedule revoked!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readContract, account);
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      setStatus('Please enter a valid amount.');
      setStatusStyle(STATUS_COLORS.error);
      return;
    }
    try {
      setStatus('Withdrawing tokens...');
      setStatusStyle(STATUS_COLORS.withdraw);
      setIsLoading(true);
      // If withdrawing the max amount, use exact contract value to avoid rounding issues
      const withdrawableExact = await readContract.getWithdrawableAmount();
      const withdrawAmountParsed = ethers.utils.parseUnits(withdrawAmount, 18);
      const finalAmount = withdrawAmountParsed.gte(withdrawableExact) ? withdrawableExact : withdrawAmountParsed;
      const tx = await contract.withdraw(finalAmount);
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setTxHash(tx.hash);
      setStatus('Withdrawal successful!');
      setStatusStyle(STATUS_COLORS.success);
      await loadDashboardData(readContract, account);
      setWithdrawAmount('');
    } catch (err) {
      setIsLoading(false);
      setTxHash('');
      setStatus(parseError(err));
      setStatusStyle(STATUS_COLORS.error);
    }
  };

  const formatDate = (timestamp) =>
    new Date(Number(timestamp) * 1000).toLocaleDateString();

  const formatTokens = (amount) =>
    Number(ethers.utils.formatUnits(amount, 18)).toLocaleString();

  const getEndDate = (schedule) => {
    try {
      const start    = ethers.BigNumber.from(schedule.start);
      const duration = ethers.BigNumber.from(schedule.duration);
      return formatDate(start.add(duration));
    } catch {
      return 'N/A';
    }
  };

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div className="shimmer-bg"></div>
      <div className="content min-h-screen p-8">
        <div className="max-w-5xl mx-auto">

          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-5xl font-bold tracking-tight" style={{ color: '#0f4c5c' }}>
                Token <span style={{ color: '#84cc16' }}>Vesting</span> Dashboard
              </h1>
              <p className="text-sm mt-2 uppercase tracking-widest font-medium" style={{ color: '#64748b' }}>
                Investor Vesting Management Interface
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
              <div className="mb-6 text-6xl">🔗</div>
              <button onClick={connectWallet}
                className="px-8 py-4 rounded-xl font-semibold text-white text-lg transition-all hover:opacity-90 mb-6"
                style={{ backgroundColor: '#84cc16' }}>
                Connect Wallet
              </button>
              <p className="text-3xl font-bold mb-3 tracking-tight" style={{ color: '#0f4c5c' }}>
                Connect your wallet to get started
              </p>
              <p className="text-sm uppercase tracking-widest" style={{ color: '#64748b' }}>
                Make sure you're on the Sepolia test network
              </p>
            </div>
          ) : (
            <>
              {/* STATS */}
              {(isAdmin || mySchedules.some(s => !s.releasable.eq(0))) && (
              <div className={`grid gap-3 mb-8 ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {[
                  { label: 'Total Locked',    value: Number(totalLocked).toLocaleString() + ' tokens' },
                  ...(isAdmin ? [{ label: 'Withdrawable', value: Number(withdrawable).toLocaleString() + ' tokens' }] : []),
                  { label: 'Active Schedules', value: scheduleCount },
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
                    <p className="text-lg font-bold" style={{ color: '#84cc16' }}>{stat.value}</p>
                  </div>
                ))}
              </div>
              )}

              {/* MY VESTING SCHEDULES */}
              {(isAdmin || mySchedules.length > 0) && (
              <div className="rounded-2xl p-6 mb-8 shadow-sm card-hover"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.6)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.8)',
                  borderLeft: '4px solid #84cc16',
                }}>
                <h2 className="text-lg font-bold mb-4" style={{ color: '#0f4c5c' }}>My Vesting Schedules</h2>

                {mySchedules.length === 0 ? (
                  <p className="text-sm" style={{ color: '#64748b' }}>No vesting schedules found for your wallet.</p>
                ) : (
                  mySchedules.map(({ vestingId, schedule, releasable, revokedReleasable }, idx) => (
                    <div key={idx} className="rounded-xl p-4 mb-4"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.5)',
                        border: '1px solid rgba(255,255,255,0.8)',
                        borderLeft: schedule.revoked ? '4px solid #dc2626' : '4px solid #3b82f6',
                      }}>

                      {!schedule.revoked && <VestingProgressBar released={schedule.released} totalAmount={schedule.totalAmount} />}

                      <div className="grid grid-cols-4 gap-3 mb-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Total Amount</p>
                          <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatTokens(schedule.totalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Released</p>
                          <p className="text-sm font-bold" style={{ color: '#1a5c38' }}>{formatTokens(schedule.released)}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Releasable Now</p>
                            <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatTokens(releasable)}</p>
                          </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Status</p>
                          <p className="text-sm font-bold" style={{
                            color: schedule.revoked ? '#dc2626' :
                              releasable.add(schedule.released).gte(schedule.totalAmount) ? '#3b82f6' : '#22c55e'
                          }}>
                            {schedule.revoked ? 'Revoked' :
                              releasable.add(schedule.released).gte(schedule.totalAmount) ? 'Vesting Complete' : 'Active'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Start Date</p>
                          <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatDate(schedule.start)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Cliff Date</p>
                          <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatDate(schedule.cliff)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>End Date</p>
                          <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{getEndDate(schedule)}</p>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-2">
                        <button
                          onClick={() => handleRelease(vestingId)}
                          disabled={isLoading || releasable.eq(0)}
                          className="px-5 py-2 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90 btn-hover"
                          style={{
                            backgroundColor: '#84cc16',
                            opacity: (isLoading || releasable.eq(0)) ? 0.5 : 1,
                            cursor:  (isLoading || releasable.eq(0)) ? 'not-allowed' : 'pointer',
                          }}>
                          Release Tokens
                        </button>
                        {isAdmin && !schedule.revoked && (
                          <button
                            onClick={() => handleRevoke(vestingId)}
                            disabled={isLoading}
                            className="px-5 py-2 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90 btn-hover"
                            style={{
                              backgroundColor: '#6b0f1a',
                              opacity: isLoading ? 0.5 : 1,
                              cursor:  isLoading ? 'not-allowed' : 'pointer',
                            }}>
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  ))
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

                  {/* CREATE SCHEDULE */}
                  <p className="text-sm font-semibold mb-3" style={{ color: '#1a5c38' }}>Create Vesting Schedule</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input type="text" placeholder="Beneficiary address (0x...)"
                      value={createBeneficiary} onChange={(e) => setCreateBeneficiary(e.target.value)}
                      className="border rounded-xl px-4 py-3 text-sm outline-none col-span-2"
                      style={{ borderColor: '#bae6fd', color: '#334155' }} />
                    <input type="number" placeholder="Amount of tokens"
                      value={createAmount} onChange={(e) => setCreateAmount(e.target.value)}
                      className="border rounded-xl px-4 py-3 text-sm outline-none"
                      style={{ borderColor: '#bae6fd', color: '#334155' }} />
                    <div className="border rounded-xl px-4 py-3 text-sm flex items-center justify-between"
                      style={{ borderColor: '#bae6fd', backgroundColor: '#fff' }}>
                      <span style={{ color: '#94a3b8', userSelect: 'none' }}>Start Date</span>
                      <input type="date"
                        value={createStart} onChange={(e) => setCreateStart(e.target.value)}
                        className="outline-none text-sm"
                        style={{ color: '#334155', border: 'none', background: 'transparent', cursor: 'pointer' }} />
                    </div>
                    <input type="number" placeholder="Cliff period (days)"
                      value={createCliff} onChange={(e) => setCreateCliff(e.target.value)}
                      className="border rounded-xl px-4 py-3 text-sm outline-none"
                      style={{ borderColor: '#bae6fd', color: '#334155' }} />
                    <input type="number" placeholder="Vesting duration (days)"
                      value={createDuration} onChange={(e) => setCreateDuration(e.target.value)}
                      className="border rounded-xl px-4 py-3 text-sm outline-none"
                      style={{ borderColor: '#bae6fd', color: '#334155' }} />
                  </div>
                  <button onClick={handleCreateSchedule} disabled={isLoading}
                    className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover mb-8"
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      opacity: isLoading ? 0.6 : 1,
                      cursor:  isLoading ? 'not-allowed' : 'pointer',
                    }}>
                    Create Schedule
                  </button>

                  {/* LOOKUP & REVOKE */}
                  <hr style={{ borderColor: 'rgba(15,76,92,0.1)', margin: '24px 0' }} />
                  <p className="text-sm font-semibold mb-3" style={{ color: '#6b0f1a' }}>Lookup & Revoke Schedule</p>
                  <div className="flex gap-3 mb-3">
                    <input type="text" placeholder="Beneficiary address (0x...)"
                      value={lookupAddress} onChange={(e) => setLookupAddress(e.target.value)}
                      className="flex-1 border rounded-xl px-4 py-3 text-sm outline-none"
                      style={{ borderColor: '#bae6fd', color: '#334155' }} />
                    <button onClick={handleLookup} disabled={lookupLoading || isLoading}
                      className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover"
                      style={{
                        backgroundColor: '#3b82f6',
                        opacity: (lookupLoading || isLoading) ? 0.6 : 1,
                        cursor:  (lookupLoading || isLoading) ? 'not-allowed' : 'pointer',
                      }}>
                      {lookupLoading ? 'Loading...' : 'Look Up'}
                    </button>
                  </div>
                  {lookupError && (
                    <p className="text-sm mb-3" style={{ color: '#dc2626' }}>{lookupError}</p>
                  )}
                  {lookupSchedules.length > 0 && (
                    <div className="mb-6">
                      {lookupSchedules.map(({ vestingId, schedule, releasable }, idx) => (
                        <div key={idx} className="rounded-xl p-4 mb-3"
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.5)',
                            border: '1px solid rgba(255,255,255,0.8)',
                            borderLeft: schedule.revoked ? '4px solid #dc2626' : '4px solid #3b82f6',
                          }}>
                          <div className="grid grid-cols-4 gap-3 mb-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Total Amount</p>
                              <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatTokens(schedule.totalAmount)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Released</p>
                              <p className="text-sm font-bold" style={{ color: '#1a5c38' }}>{formatTokens(schedule.released)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Releasable Now</p>
                              <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatTokens(releasable)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Status</p>
                              <p className="text-sm font-bold" style={{
                                color: schedule.revoked ? '#dc2626' :
                                  releasable.add(schedule.released).gte(schedule.totalAmount) ? '#3b82f6' : '#22c55e'
                              }}>
                                {schedule.revoked ? 'Revoked' :
                                  releasable.add(schedule.released).gte(schedule.totalAmount) ? 'Vesting Complete' : 'Active'}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Start Date</p>
                              <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatDate(schedule.start)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Cliff Date</p>
                              <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{formatDate(schedule.cliff)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>End Date</p>
                              <p className="text-sm font-bold" style={{ color: '#0f4c5c' }}>{getEndDate(schedule)}</p>
                            </div>
                          </div>
                          {!schedule.revoked && (
                            <button
                              onClick={() => handleRevoke(vestingId)}
                              disabled={isLoading}
                              className="px-5 py-2 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90 btn-hover"
                              style={{
                                backgroundColor: '#6b0f1a',
                                opacity: isLoading ? 0.5 : 1,
                                cursor:  isLoading ? 'not-allowed' : 'pointer',
                              }}>
                              Revoke
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* WITHDRAW */}
                  <p className="text-sm font-semibold mb-3" style={{ color: '#84cc16' }}>Withdraw Unlocked Tokens</p>
                  <div className="flex gap-3">
                    <input type="number" placeholder="Amount to withdraw"
                      value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-48 border rounded-xl px-4 py-3 text-sm outline-none"
                      style={{ borderColor: '#bae6fd', color: '#334155' }} />
                    <button onClick={handleWithdraw} disabled={isLoading}
                      className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover"
                      style={{
                        backgroundColor: '#84cc16',
                        opacity: isLoading ? 0.6 : 1,
                        cursor:  isLoading ? 'not-allowed' : 'pointer',
                      }}>
                      Withdraw
                    </button>
                    <button
                      onClick={() => setWithdrawAmount(withdrawable)}
                      disabled={isLoading}
                      className="px-4 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-hover"
                      style={{
                        backgroundColor: '#3b82f6',
                        opacity: isLoading ? 0.6 : 1,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                      }}>
                      Max
                    </button>
                  </div>
                </div>
              )}

              {/* EMPTY STATE */}
              {!isAdmin && mySchedules.length === 0 && (
                <div className="p-4 rounded-xl text-base font-medium text-center"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.4)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderLeft: '4px solid #0f4c5c',
                    color: '#64748b',
                  }}>
                  <span style={{ fontSize: '1.6rem' }}>🔐</span> Connect with a wallet that has an active vesting schedule to view your tokens.
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