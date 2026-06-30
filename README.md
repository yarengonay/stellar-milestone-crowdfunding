# Stellar Milestone Crowdfunding 🚀

A decentralized, trustless, milestone-based crowdfunding platform built on Stellar (Soroban) Smart Contracts. This project is submitted as part of the Stellar Level 2 (Blue Belt) certification.

## 🌟 Key Concept: Milestone-Based Funding
Unlike traditional crowdfunding platforms where funds are released entirely to the project creator, this contract locks the funds in escrow. 
- Funds are only released in stages (milestones) after the project creator submits proof of completion.
- Donors use their wallets to vote on whether the milestone was successfully met.
- If the majority votes yes, the milestone funds are unlocked. If rejected, funds remain locked or can be refunded.

---

## 🛠️ Level 2 Requirements Checked

1. **StellarWalletsKit**: Multi-wallet integration supporting Freighter, Albedo, and Hana.
2. **Error Handling**: Custom handler UI for:
   - Wallet not installed / found
   - Transaction rejected by user
   - Insufficient wallet balance for pledge/vote
3. **Smart Contract Deployed**: Contract deployed on Stellar Testnet.
4. **Called from Frontend**: Pledge and vote transactions signed and sent.
5. **Real-time Event Synchronization**: Listens to Soroban events to update funding status and votes in real-time.
6. **Transaction Status Tracking**: Interactive UI indicators showing pending ⏳, success ✅, and fail ❌ states with explorer links.

---

## 📁 Project Structure

- `contracts/`: Soroban Rust Smart Contract source code.
- `frontend/`: Vite + React + TypeScript web application.
- `README.md`: Setup and deployment instructions.
