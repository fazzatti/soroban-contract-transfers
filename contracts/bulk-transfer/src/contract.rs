use soroban_sdk::{contract, contractimpl, token, Address, Env, Vec};

#[contract]
pub struct BulkTransferContract;

#[contractimpl]
impl BulkTransferContract {
    pub fn one_to_one(
        env: &Env,
        asset: Address,
        from: Address,
        to: Address,
        amount: i128,
        count: u32,
    ) {
        from.require_auth();

        for _ in 0..count {
            transfer(env, asset.clone(), from.clone(), &to, amount);
        }
    }

    pub fn one_to_many(
        env: &Env,
        asset: Address,
        from: Address,
        to_list: Vec<Address>,
        amount: i128,
    ) {
        from.require_auth();

        for to in to_list {
            transfer(env, asset.clone(), from.clone(), &to, amount);
        }
    }

    pub fn many_to_one(
        env: &Env,
        asset: Address,
        from_list: Vec<Address>,
        to: Address,
        amount: i128,
    ) {
        for from in from_list {
            from.require_auth();

            transfer(env, asset.clone(), from, &to, amount);
        }
    }

    pub fn many_to_many(
        env: &Env,
        asset: Address,
        from_list: Vec<Address>,
        to_list: Vec<Address>,
        amount: i128,
    ) {
        // throw if lengths don't match
        if from_list.len() != to_list.len() {
            panic!("from_list and to_list must have the same length");
        }

        for i in 0..from_list.len() {
            from_list.get(i).unwrap().require_auth();

            transfer(
                env,
                asset.clone(),
                from_list.get(i).unwrap(),
                &to_list.get(i).unwrap(),
                amount,
            );
        }
    }
}

fn transfer(env: &Env, asset: Address, from: Address, to: &Address, amount: i128) {
    let client = token::Client::new(env, &asset);
    client.transfer(&from, to, &amount);
}
