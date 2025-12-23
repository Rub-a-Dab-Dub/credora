import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { ConfigService } from '@nestjs/config';
import { BankAccount } from 'src/banking/entities/bank-account.entity';
import { Transaction } from './entities/transaction.entity';

const MCC_CATEGORY_MAP: Record<string, string> = {
  grocery: 'groceries',
  rent: 'housing',
  salary: 'income',
  atm: 'cash',
};

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  private plaidClient: PlaidApi;

  constructor(
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    @InjectRepository(BankAccount) private acctRepo: Repository<BankAccount>,
    private config: ConfigService,
  ) {
    const configuration = new Configuration({
      basePath: PlaidEnvironments[this.config.get('PLAID_ENV') || 'sandbox'],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': this.config.get('PLAID_CLIENT_ID'),
          'PLAID-SECRET': this.config.get('PLAID_SECRET'),
        },
      },
    });

    this.plaidClient = new PlaidApi(configuration);
  }

  // CRUD for Controller
  async create(tx: Partial<Transaction>): Promise<Transaction> {
    const newTx = this.txRepo.create(tx);
    return this.txRepo.save(newTx);
  }

  async findAll(): Promise<Transaction[]> {
    return this.txRepo.find();
  }

  async findOne(id: string): Promise<Transaction> {
    const tx = await this.txRepo.findOne({ where: { id } });
    if (!tx) throw new NotFoundException(`Transaction with ID ${id} not found`);
    return tx;
  }

  async update(id: string, data: Partial<Transaction>): Promise<Transaction> {
    await this.txRepo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.txRepo.delete(id);
  }

  // --- Plaid methods ---
  async initialFetchAndStore(accessToken: string, itemId: string, provider: string) {
    if (provider !== 'plaid') throw new Error('not implemented for provider');

    const res = await this.plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: this._daysAgo(90),
      end_date: this._today(),
    });

    const txs = res.data.transactions;

    for (const t of txs) {
      await this.upsertTransactionFromPlaid(t, itemId);
    }
  }

  async syncTransactions(accessToken: string, itemId: string, provider: string) {
    return this.initialFetchAndStore(accessToken, itemId, provider);
  }

  private async upsertTransactionFromPlaid(t: any, itemId: string) {
    // Find or create bank account
    let account = await this.acctRepo.findOne({
      where: { providerAccountId: t.account_id },
    });

    if (!account) {
      account = this.acctRepo.create({
        providerAccountId: t.account_id,
        name: t.account_owner || 'Unknown',
        mask: t.account_id.slice(-4),
        type: t.account_type,
        subtype: t.account_subtype,
      }as Partial<BankAccount>);
      await this.acctRepo.save(account);
    }

    // Dedupe by provider transaction id
    const existing = await this.txRepo.findOne({
      where: { providerTransactionId: t.transaction_id },
    });
    if (existing) return existing;

    const tx = this.txRepo.create({

      providerTransactionId: t.transaction_id,
      bankAccountId: account.id,
      transactionDate: t.transactionDate,
      userId: itemId, 
      amount: Math.abs(t.amount),
      currency: t.iso_currency_code || 'USD',
      merchantName: t.merchant_name || null,
      rawDescription: t.name,
      pending: t.pending || false,
      category: this.categorizeTransaction(t),
    });

    return this.txRepo.save(tx);
  }

  categorizeTransaction(t: any) {
    if (
      t.merchant_classification &&
      t.merchant_classification.merchant_category_code
    ) {
      const mcc = t.merchant_classification.merchant_category_code.toString();
      if (mcc.startsWith('53')) return 'groceries';
      if (mcc === '4829') return 'utilities';
    }

    const name = (t.merchant_name || t.name || '').toLowerCase();
    if (!name) return 'uncategorized';

    if (name.includes('walmart') || name.includes('grocery')) return 'groceries';
    if (name.includes('uber') || name.includes('lyft')) return 'transport';
    if (name.includes('starbucks') || name.includes('coffee')) return 'dining';
    if (name.match(/payroll|salary|deposit/)) return 'income';

    return 'uncategorized';
  }

  private _today() {
    return new Date().toISOString().slice(0, 10);
  }
  private _daysAgo(days: number) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }
}
