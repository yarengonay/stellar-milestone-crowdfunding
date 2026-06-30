import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Wallet, 
  LogOut, 
  Heart, 
  Award, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ExternalLink, 
  PlusCircle, 
  Loader2,
  Vote,
  Send
} from 'lucide-react';
import { 
  StellarWalletsKit, 
  Networks 
} from '@creit.tech/stellar-wallets-kit';
import { FreighterModule, FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule, ALBEDO_ID } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { HanaModule, HANA_ID } from '@creit.tech/stellar-wallets-kit/modules/hana';
import { 
  Transaction, 
  TransactionBuilder, 
  Keypair,
  rpc as StellarRpc
} from '@stellar/stellar-sdk';
import { Client } from './client/src/client';
import { ProjectState } from './client/src/types';
import { CONFIG } from './config';
import './App.css';

// Initialize the wallets kit statically
StellarWalletsKit.init({
  modules: [
    new FreighterModule(),
    new AlbedoModule(),
    new HanaModule(),
  ],
  network: Networks.TESTNET,
});

// RPC Server connection
const rpcServer = new StellarRpc.Server(CONFIG.rpcUrl);

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

interface Activity {
  id: string;
  text: string;
  time: string;
}

interface TxStatus {
  state: 'idle' | 'pending' | 'success' | 'fail';
  message: string;
  txHash?: string;
}

function App() {
  // Wallet States
  const [connected, setConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletName, setWalletName] = useState<string>('');
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // Contract States
  const [target, setTarget] = useState<bigint>(0n);
  const [totalPledged, setTotalPledged] = useState<bigint>(0n);
  const [currentMilestone, setCurrentMilestone] = useState<number>(0);
  const [milestoneCount, setMilestoneCount] = useState<number>(0);
  const [projectState, setProjectState] = useState<ProjectState>(ProjectState.Funding);
  const [yesVotes, setYesVotes] = useState<bigint>(0n);
  const [noVotes, setNoVotes] = useState<bigint>(0n);
  const [proofUrl, setProofUrl] = useState<string>('');
  const [deadline, setDeadline] = useState<bigint>(0n);
  const [donorPledgedAmount, setDonorPledgedAmount] = useState<bigint>(0n);

  // UI Interactive States
  const [pledgeAmountInput, setPledgeAmountInput] = useState('');
  const [proofUrlInput, setProofUrlInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState<TxStatus>({ state: 'idle', message: '' });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [expandedMilestone, setExpandedMilestone] = useState<number | null>(0); // Default expand first milestone
  const [activities, setActivities] = useState<Activity[]>([
    { id: '1', text: 'Campaign contract deployed on Testnet.', time: 'Just now' }
  ]);

  // Keep a ref to the client to avoid reconstruction on every render
  const clientRef = useRef<Client | null>(null);

  // Add Toast helper
  const addToast = useCallback((type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  // Check wallet installation helper
  const isWalletInstalled = useCallback((type: string): boolean => {
    const w = window as any;
    if (type === "freighter") {
      return !!w.stellar?.isFreighter;
    }
    if (type === "albedo") {
      return true; // Web-based wallet, no extension needed!
    }
    if (type === "hana") {
      return !!w.hana;
    }
    return true;
  }, []);

  // Load contract data from RPC
  const fetchContractData = useCallback(async (address?: string) => {
    try {
      // Create a read-only client if none exists
      if (!clientRef.current) {
        clientRef.current = new Client({
          contractId: CONFIG.contractId,
          rpcUrl: CONFIG.rpcUrl,
          networkPassphrase: CONFIG.passphrase,
        });
      }

      const client = clientRef.current;

      const [
        targetTx,
        pledgedTx,
        milestoneTx,
        countTx,
        stateTx,
        votesTx,
        deadlineTx
      ] = await Promise.all([
        client.get_target(),
        client.get_total_pledged(),
        client.get_current_milestone(),
        client.get_milestone_count(),
        client.get_state(),
        client.get_votes(),
        client.get_deadline(),
      ]);

      const targetVal = (await targetTx.simulate()).result;
      const pledgedVal = (await pledgedTx.simulate()).result;
      const milestoneVal = (await milestoneTx.simulate()).result;
      const countVal = (await countTx.simulate()).result;
      const stateVal = (await stateTx.simulate()).result;
      const votesVal = (await votesTx.simulate()).result;
      const deadlineVal = (await deadlineTx.simulate()).result;

      setTarget(targetVal);
      setTotalPledged(pledgedVal);
      setCurrentMilestone(milestoneVal);
      setMilestoneCount(countVal);
      setProjectState(stateVal);
      setYesVotes(votesVal[0]);
      setNoVotes(votesVal[1]);
      setDeadline(deadlineVal);

      // Fetch proof URL if in voting phase
      if (stateVal === ProjectState.Voting) {
        try {
          const proofTx = await client.get_proof_url();
          const proofVal = (await proofTx.simulate()).result;
          setProofUrl(proofVal);
        } catch {
          setProofUrl('');
        }
      } else {
        setProofUrl('');
      }

      // Fetch donor specific pledged amount if wallet is connected
      const activeAddress = address || walletAddress;
      if (activeAddress) {
        const donorTx = await client.get_donor_amount({ donor: activeAddress });
        const donorVal = (await donorTx.simulate()).result;
        setDonorPledgedAmount(donorVal);
      } else {
        setDonorPledgedAmount(0n);
      }

    } catch (err) {
      console.error("Error fetching contract data from RPC:", err);
      addToast('error', 'Veri Çekme Hatası', 'Stellar Testnet RPC sunucusundan veri alınırken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [walletAddress, addToast]);

  // Initial load
  useEffect(() => {
    fetchContractData();
  }, [fetchContractData]);

  // Set up RPC Event polling (simulating real-time event updates)
  useEffect(() => {
    let lastLedger = 0;
    
    const fetchLatestLedger = async () => {
      try {
        const latest = await rpcServer.getLatestLedger();
        lastLedger = latest.sequence;
      } catch (err) {
        console.error("Error getting latest ledger:", err);
      }
    };

    fetchLatestLedger();

    const parseTopic = (scVal: any): string => {
      try {
        if (scVal && typeof scVal.sym === 'function') {
          return scVal.sym().toString();
        }
      } catch {}
      return "";
    };

    const interval = setInterval(async () => {
      if (lastLedger === 0) return;
      try {
        const response = await rpcServer.getEvents({
          startLedger: lastLedger,
          filters: [
            {
              type: "contract",
              contractIds: [CONFIG.contractId]
            }
          ],
          limit: 10
        });

        if (response.events && response.events.length > 0) {
          console.log("New Soroban events received:", response.events);
          
          response.events.forEach(evt => {
            const topic = parseTopic(evt.topic[0]); 
            let text = "Yeni sözleşme olayı algılandı.";
            
            if (topic.includes("pledge")) {
              text = `Bir bağışçı kampanyaya destek oldu!`;
            } else if (topic.includes("vote")) {
              text = `Yeni bir oy kullanıldı.`;
            } else if (topic.includes("approved")) {
              text = `Milestone onaylandı! Fon serbest bırakıldı.`;
            } else if (topic.includes("rejected")) {
              text = `Milestone reddedildi! Kampanya başarısız olarak işaretlendi.`;
            }

            setActivities(prev => [
              { id: evt.id, text, time: 'Just now' },
              ...prev.slice(0, 9)
            ]);
          });

          fetchContractData();
          
          const maxLedger = Math.max(...response.events.map(e => e.ledger));
          lastLedger = maxLedger + 1;
        }
      } catch (err) {
        console.error("Error polling contract events:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchContractData]);

  // Handle Real Wallet Connection
  const handleConnectWallet = async (walletType: string) => {
    setWalletModalOpen(false);

    // 1. Error Handling: Wallet Not Installed Check
    if (!isWalletInstalled(walletType)) {
      addToast('error', 'Cüzdan Bulunamadı', `${walletType} cüzdanı tarayıcınızda kurulu değil. Lütfen cüzdan eklentisini kurun.`);
      return;
    }

    try {
      setLoading(true);
      StellarWalletsKit.setWallet(walletType);
      
      const { address } = await StellarWalletsKit.getAddress();
      
      setWalletAddress(address);
      setWalletName(walletType.toUpperCase());
      setConnected(true);

      clientRef.current = new Client({
        contractId: CONFIG.contractId,
        rpcUrl: CONFIG.rpcUrl,
        networkPassphrase: CONFIG.passphrase,
        signTransaction: async (xdr: string) => {
          return await StellarWalletsKit.signTransaction(xdr, { 
            address, 
            networkPassphrase: CONFIG.passphrase 
          });
        }
      });

      addToast('success', 'Bağlantı Başarılı', `${walletType} cüzdanı ile başarıyla bağlandınız.`);
      fetchContractData(address);
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      const errStr = err.message || err.toString();
      if (errStr.includes("User reject") || errStr.includes("closed") || errStr.includes("cancel")) {
        addToast('error', 'Bağlantı İptal Edildi', 'Cüzdan bağlantısı kullanıcı tarafından iptal edildi.');
      } else {
        addToast('error', 'Bağlantı Hatası', 'Cüzdana bağlanırken beklenmeyen bir hata oluştu.');
      }
      setLoading(false);
    }
  };

  // Handle Virtual Donor Wallet Connection (MOCKED WALLET)
  const handleConnectVirtualDonorWallet = async () => {
    setWalletModalOpen(false);
    setLoading(true);
    setTxStatus({ state: 'pending', message: 'Sanal Geliştirici Cüzdanı oluşturuluyor ve Testnet üzerinde fonlanıyor...' });
    
    try {
      // 1. Generate keypair
      const pair = Keypair.random();
      const pubKey = pair.publicKey();
      
      // 2. Fund keypair via Friendbot
      const res = await fetch(`https://friendbot.stellar.org/?addr=${pubKey}`);
      if (!res.ok) throw new Error("Friendbot fonlama başarısız oldu.");
      
      setWalletAddress(pubKey);
      setWalletName('Sanal Bağışçı (Dev)');
      setConnected(true);
      
      // 3. Reconstruct Client with local signing
      clientRef.current = new Client({
        contractId: CONFIG.contractId,
        rpcUrl: CONFIG.rpcUrl,
        networkPassphrase: CONFIG.passphrase,
        signTransaction: async (xdr: string) => {
          const tx = TransactionBuilder.fromXDR(xdr, CONFIG.passphrase) as Transaction;
          tx.sign(pair);
          return { signedTxXdr: tx.toXDR() };
        }
      });
      
      setTxStatus({ state: 'success', message: 'Sanal bağışçı cüzdanı başarıyla oluşturuldu ve Friendbot ile 10,000 XLM fonlandı!' });
      addToast('success', 'Sanal Cüzdan Bağlandı', '10,000 XLM yüklü sanal cüzdanınız başarıyla aktif edildi.');
      
      fetchContractData(pubKey);
    } catch (err: any) {
      console.error("Virtual wallet creation failed:", err);
      setTxStatus({ state: 'fail', message: 'Sanal cüzdan oluşturulurken hata oluştu.' });
      addToast('error', 'Sanal Cüzdan Hatası', 'Sanal cüzdan oluşturulurken veya Friendbot ile fonlanırken hata oluştu.');
      setLoading(false);
    }
  };

  // Handle Virtual Admin Wallet Connection (MOCKED ADMIN KEY)
  const handleConnectVirtualAdminWallet = async () => {
    setWalletModalOpen(false);
    setLoading(true);
    
    try {
      const pair = Keypair.fromSecret(CONFIG.adminSecretKey);
      const pubKey = pair.publicKey();
      
      setWalletAddress(pubKey);
      setWalletName('Yönetici (Admin)');
      setConnected(true);
      
      clientRef.current = new Client({
        contractId: CONFIG.contractId,
        rpcUrl: CONFIG.rpcUrl,
        networkPassphrase: CONFIG.passphrase,
        signTransaction: async (xdr: string) => {
          const tx = TransactionBuilder.fromXDR(xdr, CONFIG.passphrase) as Transaction;
          tx.sign(pair);
          return { signedTxXdr: tx.toXDR() };
        }
      });
      
      addToast('success', 'Yönetici Girişi Başarılı', 'Proje Yöneticisi (Admin) cüzdanı başarıyla bağlandı.');
      fetchContractData(pubKey);
    } catch (err: any) {
      console.error("Virtual admin login failed:", err);
      addToast('error', 'Giriş Hatası', 'Yönetici cüzdanı bağlanırken hata oluştu.');
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setConnected(false);
    setWalletAddress('');
    setWalletName('');
    setDonorPledgedAmount(0n);
    clientRef.current = new Client({
      contractId: CONFIG.contractId,
      rpcUrl: CONFIG.rpcUrl,
      networkPassphrase: CONFIG.passphrase,
    });
    addToast('info', 'Bağlantı Kesildi', 'Cüzdan bağlantısı sonlandırıldı.');
  };

  // Transaction submission helper
  const runTransaction = async (actionName: string, executeTx: () => Promise<any>) => {
    setTxStatus({ state: 'pending', message: `${actionName} işlemi hazırlanıyor ve imza bekleniyor...` });
    try {
      const result = await executeTx();
      console.log(`${actionName} transaction result:`, result);
      
      setTxStatus({
        state: 'success',
        message: `${actionName} işlemi başarıyla onaylandı!`,
        txHash: result.hash
      });
      addToast('success', 'İşlem Başarılı', `${actionName} işlemi tamamlandı.`);
      fetchContractData();
    } catch (err: any) {
      console.error(`${actionName} transaction error:`, err);
      const errStr = err.message || err.toString();
      
      if (errStr.includes("User reject") || errStr.includes("declined") || errStr.includes("refused") || errStr.includes("cancel")) {
        setTxStatus({ state: 'fail', message: 'İşlem İptal Edildi: Cüzdandan gelen imza isteğini reddettiniz.' });
        addToast('error', 'İşlem İptal Edildi', 'Cüzdan imza isteği reddedildi.');
      } else if (errStr.includes("insufficient balance") || errStr.includes("underfunded") || errStr.includes("insufficient funds") || errStr.includes("low balance")) {
        setTxStatus({ state: 'fail', message: 'İşlem Başarısız: Cüzdanınızda işlem ücreti veya bağış miktarı için yeterli XLM bulunmuyor.' });
        addToast('error', 'Yetersiz Bakiye', 'İşlem gerçekleştirmek için cüzdan bakiyeniz yetersiz.');
      } else {
        setTxStatus({ state: 'fail', message: `İşlem Hatası: ${errStr.substring(0, 100)}...` });
        addToast('error', 'İşlem Hatası', 'Akıllı sözleşmeyle etkileşime geçilirken bir hata oluştu.');
      }
    }
  };

  // 1. Pledge (Donate) Funds
  const handlePledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pledgeAmountInput || isNaN(Number(pledgeAmountInput))) return;

    const amountXLM = parseFloat(pledgeAmountInput);
    if (amountXLM <= 0) return;

    const amountStroops = BigInt(Math.floor(amountXLM * 10_000_000));

    await runTransaction("Fonlama (Pledge)", async () => {
      const client = clientRef.current;
      if (!client) throw new Error("Client not initialized");

      const tx = await client.pledge({
        donor: walletAddress,
        amount: amountStroops
      });

      return await tx.signAndSend();
    });

    setPledgeAmountInput('');
  };

  // 2. Submit Proof (Admin Only)
  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofUrlInput) return;

    await runTransaction("Milestone Kanıtı Gönderme", async () => {
      const client = clientRef.current;
      if (!client) throw new Error("Client not initialized");

      const tx = await client.submit_proof({
        proof_url: proofUrlInput
      });

      return await tx.signAndSend();
    });

    setProofUrlInput('');
  };

  // 3. Vote on Milestone (Donors Only)
  const handleVote = async (approve: boolean) => {
    await runTransaction(`Oy Verme (${approve ? 'EVET' : 'HAYIR'})`, async () => {
      const client = clientRef.current;
      if (!client) throw new Error("Client not initialized");

      const tx = await client.vote({
        donor: walletAddress,
        approve
      });

      return await tx.signAndSend();
    });
  };

  // 4. Resolve Milestone
  const handleResolveMilestone = async () => {
    await runTransaction("Aşama Sonuçlandırma (Resolve)", async () => {
      const client = clientRef.current;
      if (!client) throw new Error("Client not initialized");

      const tx = await client.resolve_milestone();
      return await tx.signAndSend();
    });
  };

  // 5. Refund Pledged Funds
  const handleRefund = async () => {
    await runTransaction("Geri İade Alma (Refund)", async () => {
      const client = clientRef.current;
      if (!client) throw new Error("Client not initialized");

      const tx = await client.refund({
        donor: walletAddress
      });

      return await tx.signAndSend();
    });
  };

  // Helper converters
  const stroopsToXLMStr = (stroops: bigint): string => {
    return (Number(stroops) / 10_000_000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 7 });
  };

  const getPercent = (value: bigint, max: bigint): number => {
    if (max === 0n) return 0;
    const pct = Number((value * 100n) / max);
    return pct > 100 ? 100 : pct;
  };

  const getStateString = (state: ProjectState) => {
    switch(state) {
      case ProjectState.Funding: return { label: 'Aktif Fonlama', class: 'funding' };
      case ProjectState.Voting: return { label: 'Oylama Aşamasında', class: 'voting' };
      case ProjectState.Completed: return { label: 'Başarıyla Tamamlandı', class: 'completed' };
      case ProjectState.Failed: return { label: 'Başarısız / Geri İade Açık', class: 'failed' };
      default: return { label: 'Bilinmiyor', class: 'funding' };
    }
  };

  const currentDeadlineSec = Number(deadline);
  const remainingDays = currentDeadlineSec > 0 
    ? Math.max(0, Math.ceil((currentDeadlineSec - Math.floor(Date.now() / 1000)) / 86400)) 
    : 0;

  const isCampaignAdmin = connected && walletAddress === CONFIG.adminPublicKey;

  return (
    <div className="app-container">
      {/* Toast Notifications */}
      <div className="toasts-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast-item ${toast.type}`}>
            <div className={`toast-icon ${toast.type}`}>
              {toast.type === 'success' && <CheckCircle size={20} />}
              {toast.type === 'error' && <XCircle size={20} />}
              {toast.type === 'info' && <AlertCircle size={20} />}
            </div>
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="app-header glass-card">
        <div className="app-title-section">
          <Award className="logo-icon" size={32} />
          <div>
            <h1>Milestone Crowdfunding</h1>
            <p>Stellar Soroban Güvenceli Kitlesel Fonlama</p>
          </div>
        </div>
        
        {connected ? (
          <div className="wallet-badge">
            <Wallet size={16} />
            <span title={walletAddress}>{walletAddress.substring(0, 6)}...{walletAddress.substring(50)}</span>
            <span style={{color: '#8b5cf6', fontSize: '0.8rem', fontWeight: '600'}}>({walletName})</span>
            <button className="disconnect-btn" onClick={handleDisconnect} title="Bağlantıyı Kes">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button className="connect-btn" onClick={() => setWalletModalOpen(true)}>
            <Wallet size={18} />
            Cüzdan Bağla
          </button>
        )}
      </header>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
          <Loader2 className="spinner" size={48} color="#7c3aed" />
          <p>Testnet RPC verileri yükleniyor...</p>
        </div>
      ) : (
        <div className="dashboard-grid">
          {/* Main Content Column */}
          <div className="main-column">
            
            {/* Campaign Summary Card */}
            <section className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span className={`status-badge ${getStateString(projectState).class}`}>
                  {getStateString(projectState).label}
                </span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={14} />
                  Son {remainingDays} Gün (Deadline)
                </span>
              </div>

              <h2 style={{ marginBottom: '8px' }}>Yapay Zeka Destekli Tarım Robotu Geliştirme 🤖</h2>
              <p style={{ marginBottom: '24px', fontSize: '0.95rem' }}>
                Güneş enerjisiyle çalışan, otonom yabani ot temizleme ve mahsul analiz robotu projemiz için desteklerinizi bekliyoruz. Toplanan fonlar, bağışçılarımızın kontrolünde 3 aşama (Milestone) halinde serbest kalacaktır.
              </p>

              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${getPercent(totalPledged, target)}%` }}
                ></div>
              </div>

              <div className="stats-row">
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Toplanan Fon: </span>
                  <strong style={{ fontSize: '1.2rem', color: 'white' }}>{stroopsToXLMStr(totalPledged)} XLM</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Hedef: </span>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--color-cyan)' }}>{stroopsToXLMStr(target)} XLM</strong>
                </div>
              </div>
            </section>

            {/* Campaign Action Section */}
            <section className="glass-card">
              {projectState === ProjectState.Funding && (
                <div>
                  <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Heart size={20} color="var(--color-cyan)" /> Projeye Destek Ol
                  </h3>
                  
                  {connected ? (
                    <form onSubmit={handlePledge}>
                      <div className="input-group">
                        <label htmlFor="pledgeAmount">Bağış Miktarını Girin</label>
                        <div className="input-wrapper">
                          <input 
                            type="number" 
                            id="pledgeAmount" 
                            placeholder="Örn: 25.5" 
                            step="0.0000001"
                            value={pledgeAmountInput}
                            onChange={(e) => setPledgeAmountInput(e.target.value)}
                            required
                          />
                          <span className="input-suffix">XLM</span>
                        </div>
                      </div>
                      <button type="submit" className="action-btn primary">
                        <Send size={18} /> Bağış Gönder (Pledge)
                      </button>
                    </form>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px', border: '1px dashed var(--card-border)', borderRadius: 'var(--radius-md)' }}>
                      <p style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Projeyi fonlamak için önce cüzdanınızı bağlayın.</p>
                      <button className="connect-btn" style={{ margin: '0 auto' }} onClick={() => setWalletModalOpen(true)}>
                        <Wallet size={16} /> Cüzdan Bağla
                      </button>
                    </div>
                  )}

                  {donorPledgedAmount > 0n && (
                    <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(6, 182, 212, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(6, 182, 212, 0.1)', fontSize: '0.9rem', color: '#22d3ee', textAlign: 'center' }}>
                      Katkınız: <strong>{stroopsToXLMStr(donorPledgedAmount)} XLM</strong> (Oylamadaki Gücünüz)
                    </div>
                  )}
                </div>
              )}

              {projectState === ProjectState.Voting && (
                <div>
                  <h3 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Vote size={20} color="var(--color-primary)" /> Aktif Milestone Oylaması
                  </h3>
                  
                  {proofUrl ? (
                    <div style={{ marginBottom: '16px' }}>
                      <p style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
                        Proje sahibi <strong>Milestone #{currentMilestone + 1}</strong> için kanıt sundu:
                      </p>
                      <a href={proofUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.95rem', fontWeight: '500' }}>
                        Tamamlanma Kanıtını İncele (Link) <ExternalLink size={14} />
                      </a>
                    </div>
                  ) : (
                    <div style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Proje sahibinin bu aşama için kanıt yüklemesi bekleniyor...
                    </div>
                  )}

                  {/* Vote metrics visualizer */}
                  {yesVotes + noVotes > 0n ? (
                    <div>
                      <div className="vote-bar-wrapper">
                        <div 
                          className="vote-bar-yes" 
                          style={{ width: `${getPercent(yesVotes, yesVotes + noVotes)}%` }}
                        >
                          Evet ({getPercent(yesVotes, yesVotes + noVotes)}%)
                        </div>
                        <div 
                          className="vote-bar-no" 
                          style={{ width: `${getPercent(noVotes, yesVotes + noVotes)}%` }}
                        >
                          Hayır ({getPercent(noVotes, yesVotes + noVotes)}%)
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        <span>Evet Ağırlığı: {stroopsToXLMStr(yesVotes)} XLM</span>
                        <span>Hayır Ağırlığı: {stroopsToXLMStr(noVotes)} XLM</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', textAlign: 'center', margin: '16px 0', color: 'var(--text-muted)' }}>
                      Henüz oy kullanılmadı.
                    </div>
                  )}

                  {connected ? (
                    donorPledgedAmount > 0n ? (
                      <div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px', textAlign: 'center' }}>
                          Oy hakkınız bağış miktarınıza (<strong>{stroopsToXLMStr(donorPledgedAmount)} XLM</strong>) oranında hesaplanacaktır.
                        </p>
                        <div className="vote-buttons-row">
                          <button className="vote-btn yes" onClick={() => handleVote(true)}>
                            Onayla (Evet)
                          </button>
                          <button className="vote-btn no" onClick={() => handleVote(false)}>
                            Reddet (Hayır)
                          </button>
                        </div>

                        {/* Admin resolve option */}
                        {isCampaignAdmin && (
                          <div style={{ marginTop: '24px', borderTop: '1px solid var(--card-border)', paddingTop: '16px' }}>
                            <p style={{ fontSize: '0.9rem', marginBottom: '8px', color: '#c084fc' }}>Yönetici Paneli (Aşama Kararı)</p>
                            <button className="action-btn primary" onClick={handleResolveMilestone} disabled={yesVotes + noVotes === 0n}>
                              Oylamayı Kapat ve Sonuçlandır
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: '12px', background: 'rgba(236, 72, 153, 0.05)', border: '1px solid rgba(236, 72, 153, 0.1)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: '#f472b6', textAlign: 'center' }}>
                        Yalnızca bu kampanyaya bağış yapmış olanlar oylamaya katılabilir.
                      </div>
                    )
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px', border: '1px dashed var(--card-border)', borderRadius: 'var(--radius-md)' }}>
                      <p style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Oy kullanmak için cüzdanınızı bağlayın.</p>
                      <button className="connect-btn" style={{ margin: '0 auto' }} onClick={() => setWalletModalOpen(true)}>
                        <Wallet size={16} /> Cüzdan Bağla
                      </button>
                    </div>
                  )}
                </div>
              )}

              {projectState === ProjectState.Completed && (
                <div style={{ textAlign: 'center', padding: '16px' }}>
                  <CheckCircle size={48} color="#22d3ee" style={{ margin: '0 auto 12px' }} />
                  <h3>Kampanya Tamamlandı!</h3>
                  <p style={{ marginTop: '8px', fontSize: '0.95rem' }}>
                    Tüm fonlar, hedeflerin başarıyla gerçekleştirilmesinin ardından proje sahibine serbest bırakılmıştır. Katkı sağlayan tüm bağışçılarımıza teşekkür ederiz.
                  </p>
                </div>
              )}

              {projectState === ProjectState.Failed && (
                <div style={{ textAlign: 'center', padding: '16px' }}>
                  <XCircle size={48} color="#f472b6" style={{ margin: '0 auto 12px' }} />
                  <h3>Kampanya Başarısız Oldu</h3>
                  <p style={{ marginTop: '8px', fontSize: '0.95rem', marginBottom: '20px' }}>
                    Fon hedefine ulaşılamadı veya bir milestone oylamada çoğunluk tarafından reddedildi.
                  </p>

                  {connected ? (
                    donorPledgedAmount > 0n ? (
                      <div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                          Kampanyada kilitli kalan payınızı geri alabilirsiniz:
                        </p>
                        <button className="action-btn pink" onClick={handleRefund}>
                          Geri İade Talep Et ({stroopsToXLMStr(donorPledgedAmount)} XLM)
                        </button>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Kampanyaya ait bir bağış kaydınız bulunmuyor.</p>
                    )
                  ) : (
                    <button className="connect-btn" style={{ margin: '0 auto' }} onClick={() => setWalletModalOpen(true)}>
                      Cüzdan Bağla & İade Al
                    </button>
                  )}
                </div>
              )}
            </section>

          </div>

          {/* Sidebar Column */}
          <div className="sidebar-column">
            
            {/* Transaction status card */}
            {txStatus.state !== 'idle' && (
              <section className="glass-card tx-status-card">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  İşlem Durumu Takibi
                </h3>
                <div className="tx-status-row">
                  <div className="tx-status-icon">
                    {txStatus.state === 'pending' && <Loader2 className="spinner" size={20} color="#fde047" />}
                    {txStatus.state === 'success' && <CheckCircle size={20} color="#22d3ee" />}
                    {txStatus.state === 'fail' && <XCircle size={20} color="#f472b6" />}
                  </div>
                  <div>
                    <p style={{ fontSize: '0.9rem', color: 'white', fontWeight: '500' }}>{txStatus.message}</p>
                    {txStatus.txHash && (
                      <a 
                        href={`https://stellar.expert/explorer/testnet/tx/${txStatus.txHash}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}
                      >
                        Stellar Explorer'da Gör <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Milestone List Card (ROADMAP) */}
            <section className="glass-card">
              <h3 style={{ marginBottom: '6px' }}>Proje Yol Haritası (Milestones)</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Detayları ve eylemleri görmek için aşamalara tıklayın.
              </p>
              
              <div className="milestones-container">
                {/* Milestone 1 */}
                <div 
                  className={`milestone-node expandable ${currentMilestone === 0 && projectState === ProjectState.Voting ? 'active' : ''} ${currentMilestone > 0 || projectState === ProjectState.Completed ? 'completed' : ''}`}
                  onClick={() => setExpandedMilestone(expandedMilestone === 0 ? null : 0)}
                >
                  <div className={`milestone-status-icon ${currentMilestone === 0 && projectState === ProjectState.Voting ? 'active' : ''} ${currentMilestone > 0 || projectState === ProjectState.Completed ? 'completed' : 'pending'}`}>
                    <CheckCircle size={16} />
                  </div>
                  <div className="milestone-details">
                    <div className="milestone-header">
                      <span className="milestone-title">Aşama 1: Tasarım</span>
                      <span className={`milestone-badge ${currentMilestone === 0 && projectState === ProjectState.Voting ? 'active' : ''} ${currentMilestone > 0 || projectState === ProjectState.Completed ? 'completed' : 'pending'}`}>
                        {currentMilestone === 0 && projectState === ProjectState.Voting ? 'Oylanıyor' : currentMilestone > 0 || projectState === ProjectState.Completed ? 'Bitti' : 'Bekliyor'}
                      </span>
                    </div>
                    <p className="milestone-desc">3D modelleme ve şasi çizimleri.</p>
                    
                    {expandedMilestone === 0 && (
                      <div className="milestone-expanded-content" onClick={(e) => e.stopPropagation()}>
                        <div className="milestone-expanded-row">
                          <span className="milestone-expanded-label">Aşama Bütçesi:</span>
                          <span className="milestone-expanded-value">33.3 XLM</span>
                        </div>
                        <p style={{ marginTop: '8px' }}>
                          Projenin ilk aşamasında otonom robotun fiziksel tasarımı, motor tork hesaplamaları ve elektronik bileşenlerin şematik dizilimleri tamamlanacaktır.
                        </p>
                        
                        {/* Admin Submit Proof Box inside active expanded card */}
                        {isCampaignAdmin && projectState === ProjectState.Voting && currentMilestone === 0 && !proofUrl && (
                          <div style={{ marginTop: '12px', borderTop: '1px dashed var(--card-border)', paddingTop: '12px' }}>
                            <h4 style={{ color: '#c084fc', marginBottom: '8px', fontSize: '0.85rem' }}>Kanıt Gönder (Yönetici)</h4>
                            <form onSubmit={handleSubmitProof}>
                              <input 
                                type="url" 
                                placeholder="Kanıt Linki (URL)" 
                                value={proofUrlInput}
                                onChange={(e) => setProofUrlInput(e.target.value)}
                                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--card-border)', padding: '8px', borderRadius: 'var(--radius-sm)', color: 'white', fontSize: '0.8rem', marginBottom: '8px', boxSizing: 'border-box' }}
                                required
                              />
                              <button type="submit" className="action-btn primary" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                                <PlusCircle size={12} /> Kanıt Gönder (Submit Proof)
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Milestone 2 */}
                <div 
                  className={`milestone-node expandable ${currentMilestone === 1 && projectState === ProjectState.Voting ? 'active' : ''} ${currentMilestone > 1 || projectState === ProjectState.Completed ? 'completed' : ''}`}
                  onClick={() => setExpandedMilestone(expandedMilestone === 1 ? null : 1)}
                >
                  <div className={`milestone-status-icon ${currentMilestone === 1 && projectState === ProjectState.Voting ? 'active' : ''} ${currentMilestone > 1 || projectState === ProjectState.Completed ? 'completed' : 'pending'}`}>
                    <CheckCircle size={16} />
                  </div>
                  <div className="milestone-details">
                    <div className="milestone-header">
                      <span className="milestone-title">Aşama 2: Şasi & Devre</span>
                      <span className={`milestone-badge ${currentMilestone === 1 && projectState === ProjectState.Voting ? 'active' : ''} ${currentMilestone > 1 || projectState === ProjectState.Completed ? 'completed' : ''}`}>
                        {currentMilestone === 1 && projectState === ProjectState.Voting ? 'Oylanıyor' : currentMilestone > 1 || projectState === ProjectState.Completed ? 'Bitti' : 'Bekliyor'}
                      </span>
                    </div>
                    <p className="milestone-desc">Metal şasi ve PCB baskı.</p>
                    
                    {expandedMilestone === 1 && (
                      <div className="milestone-expanded-content" onClick={(e) => e.stopPropagation()}>
                        <div className="milestone-expanded-row">
                          <span className="milestone-expanded-label">Aşama Bütçesi:</span>
                          <span className="milestone-expanded-value">33.3 XLM</span>
                        </div>
                        <p style={{ marginTop: '8px' }}>
                          Metal gövdenin lazer kesim ile üretilmesi, step motorların montajı, güç kartlarının ve sensor modüllerinin PCB baskı devresine lehimlenmesi.
                        </p>
                        
                        {isCampaignAdmin && projectState === ProjectState.Voting && currentMilestone === 1 && !proofUrl && (
                          <div style={{ marginTop: '12px', borderTop: '1px dashed var(--card-border)', paddingTop: '12px' }}>
                            <h4 style={{ color: '#c084fc', marginBottom: '8px', fontSize: '0.85rem' }}>Kanıt Gönder (Yönetici)</h4>
                            <form onSubmit={handleSubmitProof}>
                              <input 
                                type="url" 
                                placeholder="Kanıt Linki (URL)" 
                                value={proofUrlInput}
                                onChange={(e) => setProofUrlInput(e.target.value)}
                                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--card-border)', padding: '8px', borderRadius: 'var(--radius-sm)', color: 'white', fontSize: '0.8rem', marginBottom: '8px', boxSizing: 'border-box' }}
                                required
                              />
                              <button type="submit" className="action-btn primary" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                                <PlusCircle size={12} /> Kanıt Gönder (Submit Proof)
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Milestone 3 */}
                <div 
                  className={`milestone-node expandable ${currentMilestone === 2 && projectState === ProjectState.Voting ? 'active' : ''} ${currentMilestone > 2 || projectState === ProjectState.Completed ? 'completed' : ''}`}
                  onClick={() => setExpandedMilestone(expandedMilestone === 2 ? null : 2)}
                >
                  <div className={`milestone-status-icon ${currentMilestone === 2 && projectState === ProjectState.Voting ? 'active' : ''} ${currentMilestone > 2 || projectState === ProjectState.Completed ? 'completed' : 'pending'}`}>
                    <CheckCircle size={16} />
                  </div>
                  <div className="milestone-details">
                    <div className="milestone-header">
                      <span className="milestone-title">Aşama 3: Yazılım</span>
                      <span className={`milestone-badge ${currentMilestone === 2 && projectState === ProjectState.Voting ? 'active' : ''} ${currentMilestone > 2 || projectState === ProjectState.Completed ? 'completed' : ''}`}>
                        {currentMilestone === 2 && projectState === ProjectState.Voting ? 'Oylanıyor' : currentMilestone > 2 || projectState === ProjectState.Completed ? 'Bitti' : 'Bekliyor'}
                      </span>
                    </div>
                    <p className="milestone-desc">Yapay zeka modellerinin testi.</p>
                    
                    {expandedMilestone === 2 && (
                      <div className="milestone-expanded-content" onClick={(e) => e.stopPropagation()}>
                        <div className="milestone-expanded-row">
                          <span className="milestone-expanded-label">Aşama Bütçesi:</span>
                          <span className="milestone-expanded-value">33.3 XLM</span>
                        </div>
                        <p style={{ marginTop: '8px' }}>
                          Yabani ot tespiti için eğitilen hafif CNN derin öğrenme modelinin Raspberry Pi / Jetson Nano üzerine gömülmesi ve tarla simülasyon saha testleri.
                        </p>
                        
                        {isCampaignAdmin && projectState === ProjectState.Voting && currentMilestone === 2 && !proofUrl && (
                          <div style={{ marginTop: '12px', borderTop: '1px dashed var(--card-border)', paddingTop: '12px' }}>
                            <h4 style={{ color: '#c084fc', marginBottom: '8px', fontSize: '0.85rem' }}>Kanıt Gönder (Yönetici)</h4>
                            <form onSubmit={handleSubmitProof}>
                              <input 
                                type="url" 
                                placeholder="Kanıt Linki (URL)" 
                                value={proofUrlInput}
                                onChange={(e) => setProofUrlInput(e.target.value)}
                                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--card-border)', padding: '8px', borderRadius: 'var(--radius-sm)', color: 'white', fontSize: '0.8rem', marginBottom: '8px', boxSizing: 'border-box' }}
                                required
                              />
                              <button type="submit" className="action-btn primary" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                                <PlusCircle size={12} /> Kanıt Gönder (Submit Proof)
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Live Contract Events */}
            <section className="glass-card">
              <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="var(--color-cyan)" /> Canlı Aktivite Akışı (Events)
              </h3>
              <div className="activity-feed-list">
                {activities.map(activity => (
                  <div key={activity.id} className="activity-item">
                    <span className="activity-text">{activity.text}</span>
                    <span className="activity-time">{activity.time}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Wallet Selector Modal */}
      {walletModalOpen && (
        <div className="modal-overlay" onClick={() => setWalletModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setWalletModalOpen(false)}>×</button>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Cüzdan Bağla</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Uygulamaya bağlanmak için aşağıdaki yöntemlerden birini seçin.</p>
            
            <div className="wallet-options-list">
              {/* DEV / MOCK OPTIONS FIRST */}
              <div className="wallet-option-item dev" onClick={handleConnectVirtualDonorWallet}>
                <div className="wallet-logo-container">
                  <span style={{ fontSize: '1.25rem' }}>⚡</span>
                </div>
                <div>
                  <div className="wallet-name" style={{color: '#22d3ee'}}>Sanal Bağışçı Cüzdanı (Önerilen)</div>
                  <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px'}}>Tarayıcı eklentisi gerektirmez. Friendbot ile anında fonlanır.</div>
                </div>
              </div>

              <div className="wallet-option-item admin-dev" onClick={handleConnectVirtualAdminWallet}>
                <div className="wallet-logo-container">
                  <span style={{ fontSize: '1.25rem' }}>🔑</span>
                </div>
                <div>
                  <div className="wallet-name" style={{color: '#f472b6'}}>Sanal Yönetici (Admin) Cüzdanı</div>
                  <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px'}}>Sözleşmenin sahibidir. Kanıt gönderebilir ve milestone yönetebilir.</div>
                </div>
              </div>

              {/* SEPARATOR */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
                <div style={{ flexGrow: 1, height: '1px', background: 'var(--card-border)' }}></div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Eklenti Cüzdanları</span>
                <div style={{ flexGrow: 1, height: '1px', background: 'var(--card-border)' }}></div>
              </div>

              {/* REAL WALLETS */}
              <div className="wallet-option-item" onClick={() => handleConnectWallet("freighter")}>
                <div className="wallet-logo-container">
                  <span style={{ fontSize: '1.25rem' }}>⚓</span>
                </div>
                <div>
                  <div className="wallet-name">Freighter Wallet</div>
                  <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>{isWalletInstalled("freighter") ? "Kurulu (Aktif)" : "Eklenti kurulu değil"}</div>
                </div>
              </div>

              <div className="wallet-option-item" onClick={() => handleConnectWallet("albedo")}>
                <div className="wallet-logo-container">
                  <span style={{ fontSize: '1.25rem' }}>🌌</span>
                </div>
                <div>
                  <div className="wallet-name">Albedo (Web API)</div>
                  <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>Tarayıcı tabanlı yetkilendirme</div>
                </div>
              </div>

              <div className="wallet-option-item" onClick={() => handleConnectWallet("hana")}>
                <div className="wallet-logo-container">
                  <span style={{ fontSize: '1.25rem' }}>🌸</span>
                </div>
                <div>
                  <div className="wallet-name">Hana Wallet</div>
                  <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>{isWalletInstalled("hana") ? "Kurulu (Aktif)" : "Eklenti kurulu değil"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
