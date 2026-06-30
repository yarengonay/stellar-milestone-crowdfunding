#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env, String};

#[test]
fn test_crowdfunding_flow() {
    let env = Env::default();
    env.mock_all_auths();

    // Setup actors
    let admin = Address::generate(&env);
    let donor_1 = Address::generate(&env);
    let donor_2 = Address::generate(&env);

    // Setup Mock Token
    let token_admin = Address::generate(&env);
    let token_contract_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = token::Client::new(&env, &token_contract_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract_id);

    // Mint tokens to donors
    token_admin_client.mint(&donor_1, &1000);
    token_admin_client.mint(&donor_2, &2000);

    // Register Crowdfunding Contract
    let contract_id = env.register_contract(None, MilestoneCrowdfunding);
    let client = MilestoneCrowdfundingClient::new(&env, &contract_id);

    // Initialize campaign
    let target = 1500i128;
    let deadline = 100u64;
    let milestones = 3u32;
    client.initialize(&admin, &token_contract_id, &target, &deadline, &milestones);

    // Check configuration
    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_token(), token_contract_id);
    assert_eq!(client.get_target(), target);
    assert_eq!(client.get_deadline(), deadline);
    assert_eq!(client.get_milestone_count(), milestones);
    assert_eq!(client.get_current_milestone(), 0);
    assert!(client.get_state() == ProjectState::Funding);

    // Donors pledge funds
    client.pledge(&donor_1, &500);
    client.pledge(&donor_2, &1000);

    assert_eq!(client.get_donor_amount(&donor_1), 500);
    assert_eq!(client.get_donor_amount(&donor_2), 1000);
    assert_eq!(client.get_total_pledged(), 1500);
    assert_eq!(token_client.balance(&contract_id), 1500);

    // Try submitting proof - Target reached, state transitions to Voting
    let proof_url = String::from_str(&env, "https://ipfs.io/ipfs/milestone1_proof");
    client.submit_proof(&proof_url);
    assert!(client.get_state() == ProjectState::Voting);
    assert_eq!(client.get_proof_url(), proof_url);

    // Cast votes
    client.vote(&donor_1, &true); // 500 weight
    client.vote(&donor_2, &true); // 1000 weight

    let (yes_votes, no_votes) = client.get_votes();
    assert_eq!(yes_votes, 1500);
    assert_eq!(no_votes, 0);

    // Resolve milestone
    client.resolve_milestone();

    // Milestone 0 finished. Share is 1500 / 3 = 500 released to admin.
    assert_eq!(client.get_current_milestone(), 1);
    assert_eq!(token_client.balance(&admin), 500);
    assert_eq!(token_client.balance(&contract_id), 1000);

    // Submit proof for milestone 1
    let proof_url_2 = String::from_str(&env, "https://ipfs.io/ipfs/milestone2_proof");
    client.submit_proof(&proof_url_2);

    // Donor 1 votes YES (500), Donor 2 votes NO (1000)
    client.vote(&donor_1, &true);
    client.vote(&donor_2, &false);

    let (yes_votes_2, no_votes_2) = client.get_votes();
    assert_eq!(yes_votes_2, 500);
    assert_eq!(no_votes_2, 1000);

    // Resolve milestone - should reject because no_votes > yes_votes
    client.resolve_milestone();
    assert!(client.get_state() == ProjectState::Failed);

    // Test refund
    // For donor 1, they pledged 500. 1 milestone was completed (milestone 0). 2 milestones remained (milestones 1 and 2).
    // Remaining share refund: 500 * 2 / 3 = 333
    // For donor 2, pledged 1000. Refund: 1000 * 2 / 3 = 666
    let donor_1_balance_before = token_client.balance(&donor_1);
    let donor_2_balance_before = token_client.balance(&donor_2);

    client.refund(&donor_1);
    client.refund(&donor_2);

    assert_eq!(token_client.balance(&donor_1) - donor_1_balance_before, 333);
    assert_eq!(token_client.balance(&donor_2) - donor_2_balance_before, 666);
}
