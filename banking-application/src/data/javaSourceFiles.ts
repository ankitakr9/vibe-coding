export interface JavaSourceFile {
  fileName: string;
  packagePath: string;
  concept: string;
  summary: string;
  code: string;
}

export const JAVA_SOURCE_FILES: JavaSourceFile[] = [
  {
    fileName: 'Account.java',
    packagePath: 'com/alderbank/model/Account.java',
    concept: 'Core Java & Encapsulation',
    summary: 'Domain model using BigDecimal for exact monetary precision and salted PBKDF2 PIN verification.',
    code: `package com.alderbank.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Account {
    private final String accountNumber;
    private final String fullName;
    private final String accountType;
    private final String pinSalt;
    private final String pinHash;
    private final Instant createdAt;
    private BigDecimal balance;
    private final List<Transaction> transactions;

    public Account(
        String accountNumber,
        String fullName,
        String accountType,
        String pinSalt,
        String pinHash,
        BigDecimal initialBalance,
        Instant createdAt
    ) {
        this.accountNumber = accountNumber;
        this.fullName = fullName;
        this.accountType = accountType;
        this.pinSalt = pinSalt;
        this.pinHash = pinHash;
        this.balance = initialBalance;
        this.createdAt = createdAt;
        this.transactions = new ArrayList<>();
    }

    public String getAccountNumber() { return accountNumber; }
    public String getFullName() { return fullName; }
    public String getAccountType() { return accountType; }
    public String getPinSalt() { return pinSalt; }
    public String getPinHash() { return pinHash; }
    public Instant getCreatedAt() { return createdAt; }
    public BigDecimal getBalance() { return balance; }

    public List<Transaction> getTransactions() {
        return Collections.unmodifiableList(transactions);
    }

    public void applyDeposit(BigDecimal amount, Transaction record) {
        this.balance = this.balance.add(amount);
        this.transactions.add(record);
    }

    public void applyWithdrawal(BigDecimal amount, Transaction record) {
        if (amount.compareTo(this.balance) > 0) {
            throw new IllegalStateException("Insufficient funds for withdrawal.");
        }
        this.balance = this.balance.subtract(amount);
        this.transactions.add(record);
    }

    public void restoreTransaction(Transaction record) {
        this.transactions.add(record);
    }
}
`,
  },
  {
    fileName: 'Transaction.java',
    packagePath: 'com/alderbank/model/Transaction.java',
    concept: 'Java Records & Enums',
    summary: 'Immutable transaction record capturing timestamp, type, amount, running balance, and memo.',
    code: `package com.alderbank.model;

import java.math.BigDecimal;
import java.time.Instant;

public record Transaction(
    String id,
    String accountNumber,
    Type type,
    BigDecimal amount,
    BigDecimal balanceAfter,
    String description,
    String counterpartyAccount,
    Instant timestamp
) {
    public enum Type {
        DEPOSIT,
        WITHDRAWAL,
        TRANSFER_OUT,
        TRANSFER_IN
    }

    public String toCsvRow() {
        return String.join(",",
            id,
            accountNumber,
            type.name(),
            amount.toPlainString(),
            balanceAfter.toPlainString(),
            description.replace(",", " "),
            counterpartyAccount == null ? "" : counterpartyAccount,
            timestamp.toString()
        );
    }
}
`,
  },
  {
    fileName: 'BankService.java',
    packagePath: 'com/alderbank/service/BankService.java',
    concept: 'Java Collections & Input Validation',
    summary: 'Manages in-memory Map<String, Account> collections, PBKDF2 hashing, validation rules, and atomic transfers.',
    code: `package com.alderbank.service;

import com.alderbank.model.Account;
import com.alderbank.model.Transaction;
import com.alderbank.storage.FileStorage;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.io.IOException;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

public class BankService {
    private static final BigDecimal MAX_TX = new BigDecimal("1000000.00");
    private final Map<String, Account> accounts = new HashMap<>();
    private final AtomicInteger accountSeq = new AtomicInteger(1001);
    private final AtomicInteger txSeq = new AtomicInteger(1001);
    private final FileStorage storage;

    public BankService(FileStorage storage) throws IOException {
        this.storage = storage;
        this.accounts.putAll(storage.loadAll(accountSeq, txSeq));
    }

    public synchronized Account register(String fullName, String type, String pin, BigDecimal initialDeposit) throws IOException {
        if (fullName == null || fullName.trim().length() < 2) {
            throw new IllegalArgumentException("Full name must be at least 2 characters.");
        }
        if (pin == null || pin.trim().length() < 4) {
            throw new IllegalArgumentException("PIN must be at least 4 characters.");
        }
        if (initialDeposit.compareTo(BigDecimal.ZERO) < 0 || initialDeposit.scale() > 2) {
            throw new IllegalArgumentException("Initial deposit must be >= 0.00 with up to 2 decimals.");
        }

        String accNo = "AB-" + accountSeq.getAndIncrement();
        String salt = generateSalt();
        String hash = hashPin(pin.trim(), salt);

        Account account = new Account(accNo, fullName.trim(), type, salt, hash, BigDecimal.ZERO, Instant.now());
        if (initialDeposit.compareTo(BigDecimal.ZERO) > 0) {
            Transaction tx = new Transaction(
                "TX-" + txSeq.getAndIncrement(),
                accNo,
                Transaction.Type.DEPOSIT,
                initialDeposit,
                initialDeposit,
                "Opening Account Deposit",
                null,
                Instant.now()
            );
            account.applyDeposit(initialDeposit, tx);
        }

        accounts.put(accNo, account);
        storage.saveAll(accounts.values());
        return account;
    }

    public Optional<Account> authenticate(String accountNumber, String pin) {
        if (accountNumber == null || pin == null) return Optional.empty();
        Account account = accounts.get(accountNumber.trim().toUpperCase());
        if (account == null) return Optional.empty();

        String candidate = hashPin(pin.trim(), account.getPinSalt());
        boolean match = MessageDigest.isEqual(candidate.getBytes(), account.getPinHash().getBytes());
        return match ? Optional.of(account) : Optional.empty();
    }

    public synchronized Transaction deposit(Account account, BigDecimal amount, String memo) throws IOException {
        validatePositiveAmount(amount);
        BigDecimal nextBalance = account.getBalance().add(amount);
        Transaction tx = new Transaction(
            "TX-" + txSeq.getAndIncrement(),
            account.getAccountNumber(),
            Transaction.Type.DEPOSIT,
            amount,
            nextBalance,
            memo.isBlank() ? "Cash Deposit" : memo.trim(),
            null,
            Instant.now()
        );
        account.applyDeposit(amount, tx);
        storage.saveAll(accounts.values());
        return tx;
    }

    public synchronized Transaction withdraw(Account account, BigDecimal amount, String memo) throws IOException {
        validatePositiveAmount(amount);
        if (amount.compareTo(account.getBalance()) > 0) {
            throw new IllegalArgumentException("Insufficient funds.");
        }
        BigDecimal nextBalance = account.getBalance().subtract(amount);
        Transaction tx = new Transaction(
            "TX-" + txSeq.getAndIncrement(),
            account.getAccountNumber(),
            Transaction.Type.WITHDRAWAL,
            amount,
            nextBalance,
            memo.isBlank() ? "Cash Withdrawal" : memo.trim(),
            null,
            Instant.now()
        );
        account.applyWithdrawal(amount, tx);
        storage.saveAll(accounts.values());
        return tx;
    }

    public List<Transaction> getHistory(Account account) {
        return account.getTransactions();
    }

    private void validatePositiveAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0 || amount.scale() > 2 || amount.compareTo(MAX_TX) > 0) {
            throw new IllegalArgumentException("Enter a positive amount up to $1,000,000.00 (max 2 decimals).");
        }
    }

    private String generateSalt() {
        byte[] bytes = new byte[16];
        new SecureRandom().nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }

    private String hashPin(String pin, String salt) {
        try {
            PBEKeySpec spec = new PBEKeySpec(pin.toCharArray(), Base64.getDecoder().decode(salt), 65536, 256);
            SecretKeyFactory skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            return Base64.getEncoder().encodeToString(skf.generateSecret(spec).getEncoded());
        } catch (Exception e) {
            throw new IllegalStateException("PIN hashing failed", e);
        }
    }
}
`,
  },
  {
    fileName: 'FileStorage.java',
    packagePath: 'com/alderbank/storage/FileStorage.java',
    concept: 'Java File I/O (java.nio.file)',
    summary: 'Atomic file persistence writing accounts and transaction logs using BufferedWriter and atomic file move.',
    code: `package com.alderbank.storage;

import com.alderbank.model.Account;
import com.alderbank.model.Transaction;

import java.io.BufferedWriter;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

public class FileStorage {
    private final Path dataFile;

    public FileStorage(Path dataFile) {
        this.dataFile = dataFile;
    }

    public void saveAll(Collection<Account> accounts) throws IOException {
        Files.createDirectories(dataFile.getParent());
        Path tempFile = dataFile.resolveSibling(dataFile.getFileName() + ".tmp");

        try (BufferedWriter writer = Files.newBufferedWriter(tempFile, StandardCharsets.UTF_8)) {
            for (Account acc : accounts) {
                writer.write(String.join("|",
                    "ACC",
                    acc.getAccountNumber(),
                    acc.getFullName().replace("|", " "),
                    acc.getAccountType(),
                    acc.getPinSalt(),
                    acc.getPinHash(),
                    acc.getBalance().toPlainString(),
                    acc.getCreatedAt().toString()
                ));
                writer.newLine();

                for (Transaction tx : acc.getTransactions()) {
                    writer.write(String.join("|",
                        "TX",
                        tx.id(),
                        tx.accountNumber(),
                        tx.type().name(),
                        tx.amount().toPlainString(),
                        tx.balanceAfter().toPlainString(),
                        tx.description().replace("|", " "),
                        tx.counterpartyAccount() == null ? "" : tx.counterpartyAccount(),
                        tx.timestamp().toString()
                    ));
                    writer.newLine();
                }
            }
        }

        Files.move(tempFile, dataFile, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    }

    public Map<String, Account> loadAll(AtomicInteger accountSeq, AtomicInteger txSeq) throws IOException {
        Map<String, Account> loaded = new HashMap<>();
        if (!Files.exists(dataFile)) {
            return loaded;
        }

        List<String> lines = Files.readAllLines(dataFile, StandardCharsets.UTF_8);
        for (String line : lines) {
            if (line.isBlank()) continue;
            String[] parts = line.split("\\\\|", -1);
            if ("ACC".equals(parts[0]) && parts.length >= 8) {
                Account acc = new Account(
                    parts[1], parts[2], parts[3], parts[4], parts[5],
                    new BigDecimal(parts[6]), Instant.parse(parts[7])
                );
                loaded.put(acc.getAccountNumber(), acc);
                int seq = Integer.parseInt(parts[1].replace("AB-", ""));
                accountSeq.accumulateAndGet(seq + 1, Math::max);
            } else if ("TX".equals(parts[0]) && parts.length >= 9) {
                Account owner = loaded.get(parts[2]);
                if (owner != null) {
                    Transaction tx = new Transaction(
                        parts[1], parts[2], Transaction.Type.valueOf(parts[3]),
                        new BigDecimal(parts[4]), new BigDecimal(parts[5]),
                        parts[6], parts[7].isEmpty() ? null : parts[7],
                        Instant.parse(parts[8])
                    );
                    owner.restoreTransaction(tx);
                    int seq = Integer.parseInt(parts[1].replace("TX-", ""));
                    txSeq.accumulateAndGet(seq + 1, Math::max);
                }
            }
        }
        return loaded;
    }
}
`,
  },
  {
    fileName: 'SqliteRepository.java',
    packagePath: 'com/alderbank/storage/SqliteRepository.java',
    concept: 'SQLite & Parameterized JDBC',
    summary: 'Drop-in SQLite JDBC persistence using transactions and PreparedStatement to prevent SQL injection.',
    code: `package com.alderbank.storage;

import com.alderbank.model.Transaction;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class SqliteRepository {
    private final String jdbcUrl;

    public SqliteRepository(String dbPath) throws SQLException {
        this.jdbcUrl = "jdbc:sqlite:" + dbPath;
        initializeSchema();
    }

    private void initializeSchema() throws SQLException {
        try (Connection conn = DriverManager.getConnection(jdbcUrl);
             Statement st = conn.createStatement()) {
            st.execute("""
                CREATE TABLE IF NOT EXISTS accounts (
                    account_number TEXT PRIMARY KEY,
                    full_name TEXT NOT NULL,
                    account_type TEXT NOT NULL,
                    pin_salt TEXT NOT NULL,
                    pin_hash TEXT NOT NULL,
                    balance_cents INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                )
            """);
            st.execute("""
                CREATE TABLE IF NOT EXISTS transactions (
                    id TEXT PRIMARY KEY,
                    account_number TEXT NOT NULL,
                    type TEXT NOT NULL,
                    amount_cents INTEGER NOT NULL,
                    balance_after_cents INTEGER NOT NULL,
                    description TEXT NOT NULL,
                    counterparty_account TEXT,
                    timestamp TEXT NOT NULL,
                    FOREIGN KEY (account_number) REFERENCES accounts(account_number)
                )
            """);
        }
    }

    public void recordTransactionAtomic(Transaction tx, long newBalanceCents) throws SQLException {
        try (Connection conn = DriverManager.getConnection(jdbcUrl)) {
            conn.setAutoCommit(false);
            try (PreparedStatement updateBal = conn.prepareStatement(
                     "UPDATE accounts SET balance_cents = ? WHERE account_number = ?");
                 PreparedStatement insertTx = conn.prepareStatement(
                     "INSERT INTO transactions (id, account_number, type, amount_cents, balance_after_cents, description, counterparty_account, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {

                updateBal.setLong(1, newBalanceCents);
                updateBal.setString(2, tx.accountNumber());
                updateBal.executeUpdate();

                insertTx.setString(1, tx.id());
                insertTx.setString(2, tx.accountNumber());
                insertTx.setString(3, tx.type().name());
                insertTx.setLong(4, tx.amount().movePointRight(2).longValueExact());
                insertTx.setLong(5, newBalanceCents);
                insertTx.setString(6, tx.description());
                insertTx.setString(7, tx.counterpartyAccount());
                insertTx.setString(8, tx.timestamp().toString());
                insertTx.executeUpdate();

                conn.commit();
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            }
        }
    }

    public List<Transaction> findByAccount(String accountNumber) throws SQLException {
        List<Transaction> list = new ArrayList<>();
        String sql = "SELECT id, account_number, type, amount_cents, balance_after_cents, description, counterparty_account, timestamp FROM transactions WHERE account_number = ? ORDER BY timestamp DESC";
        try (Connection conn = DriverManager.getConnection(jdbcUrl);
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, accountNumber);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(new Transaction(
                        rs.getString("id"),
                        rs.getString("account_number"),
                        Transaction.Type.valueOf(rs.getString("type")),
                        BigDecimal.valueOf(rs.getLong("amount_cents"), 2),
                        BigDecimal.valueOf(rs.getLong("balance_after_cents"), 2),
                        rs.getString("description"),
                        rs.getString("counterparty_account"),
                        Instant.parse(rs.getString("timestamp"))
                    ));
                }
            }
        }
        return list;
    }
}
`,
  },
  {
    fileName: 'BankingAppFX.java',
    packagePath: 'com/alderbank/ui/BankingAppFX.java',
    concept: 'JavaFX Desktop GUI',
    summary: 'Complete JavaFX Application with login scene, balance readout, deposit/withdraw controls, and transaction TableView.',
    code: `package com.alderbank.ui;

import com.alderbank.model.Account;
import com.alderbank.model.Transaction;
import com.alderbank.service.BankService;
import com.alderbank.storage.FileStorage;
import javafx.application.Application;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.geometry.Insets;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.layout.*;
import javafx.stage.Stage;

import java.math.BigDecimal;
import java.nio.file.Path;

public class BankingAppFX extends Application {
    private BankService bankService;
    private Account activeAccount;
    private Label balanceLabel;
    private TableView<Transaction> ledgerTable;

    @Override
    public void start(Stage stage) throws Exception {
        bankService = new BankService(new FileStorage(Path.of("data", "alder_ledger.txt")));
        stage.setTitle("Alder Bank — JavaFX Client");
        stage.setScene(buildLoginScene(stage));
        stage.show();
    }

    private Scene buildLoginScene(Stage stage) {
        TextField accField = new TextField();
        accField.setPromptText("Account Number (e.g., AB-1001)");
        PasswordField pinField = new PasswordField();
        pinField.setPromptText("PIN");
        Label status = new Label();

        Button loginBtn = new Button("Sign In");
        loginBtn.setOnAction(e -> bankService.authenticate(accField.getText(), pinField.getText())
            .ifPresentOrElse(account -> {
                this.activeAccount = account;
                stage.setScene(buildDashboardScene(stage));
            }, () -> status.setText("Invalid account number or PIN.")));

        TextField nameField = new TextField();
        nameField.setPromptText("Full Name");
        PasswordField newPinField = new PasswordField();
        newPinField.setPromptText("Choose 4+ char PIN");
        TextField initDepositField = new TextField("100.00");

        Button registerBtn = new Button("Open Checking Account");
        registerBtn.setOnAction(e -> {
            try {
                Account created = bankService.register(
                    nameField.getText(), "Checking", newPinField.getText(),
                    new BigDecimal(initDepositField.getText().trim())
                );
                this.activeAccount = created;
                stage.setScene(buildDashboardScene(stage));
            } catch (Exception ex) {
                status.setText(ex.getMessage());
            }
        });

        VBox root = new VBox(12,
            new Label("Sign In"), accField, pinField, loginBtn,
            new Separator(),
            new Label("Open New Account"), nameField, newPinField, initDepositField, registerBtn,
            status
        );
        root.setPadding(new Insets(24));
        return new Scene(root, 420, 440);
    }

    private Scene buildDashboardScene(Stage stage) {
        balanceLabel = new Label("$" + activeAccount.getBalance().toPlainString());
        balanceLabel.setStyle("-fx-font-size: 28px; -fx-font-weight: bold;");

        TextField amountField = new TextField();
        amountField.setPromptText("Amount (e.g. 50.00)");
        TextField memoField = new TextField();
        memoField.setPromptText("Memo");
        Label feedback = new Label();

        Button depositBtn = new Button("Deposit");
        depositBtn.setOnAction(e -> handleOperation(true, amountField, memoField, feedback));

        Button withdrawBtn = new Button("Withdraw");
        withdrawBtn.setOnAction(e -> handleOperation(false, amountField, memoField, feedback));

        Button signOutBtn = new Button("Sign Out");
        signOutBtn.setOnAction(e -> {
            activeAccount = null;
            stage.setScene(buildLoginScene(stage));
        });

        ledgerTable = new TableView<>();
        TableColumn<Transaction, String> idCol = new TableColumn<>("Ref");
        idCol.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().id()));
        TableColumn<Transaction, String> typeCol = new TableColumn<>("Type");
        typeCol.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().type().name()));
        TableColumn<Transaction, String> amtCol = new TableColumn<>("Amount");
        amtCol.setCellValueFactory(c -> new SimpleStringProperty("$" + c.getValue().amount().toPlainString()));
        TableColumn<Transaction, String> memoCol = new TableColumn<>("Memo");
        memoCol.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().description()));
        ledgerTable.getColumns().addAll(idCol, typeCol, amtCol, memoCol);
        refreshView();

        HBox controls = new HBox(8, amountField, memoField, depositBtn, withdrawBtn, signOutBtn);
        VBox layout = new VBox(14,
            new Label(activeAccount.getFullName() + " · " + activeAccount.getAccountNumber()),
            balanceLabel, controls, feedback, ledgerTable
        );
        layout.setPadding(new Insets(20));
        return new Scene(layout, 760, 520);
    }

    private void handleOperation(boolean isDeposit, TextField amountField, TextField memoField, Label feedback) {
        try {
            BigDecimal amount = new BigDecimal(amountField.getText().trim());
            if (isDeposit) {
                bankService.deposit(activeAccount, amount, memoField.getText());
                feedback.setText("Deposit recorded.");
            } else {
                bankService.withdraw(activeAccount, amount, memoField.getText());
                feedback.setText("Withdrawal recorded.");
            }
            amountField.clear();
            memoField.clear();
            refreshView();
        } catch (Exception ex) {
            feedback.setText("Error: " + ex.getMessage());
        }
    }

    private void refreshView() {
        balanceLabel.setText("$" + activeAccount.getBalance().toPlainString());
        ledgerTable.setItems(FXCollections.observableArrayList(bankService.getHistory(activeAccount)));
    }

    public static void main(String[] args) {
        launch(args);
    }
}
`,
  },
  {
    fileName: 'ConsoleBankingApp.java',
    packagePath: 'com/alderbank/cli/ConsoleBankingApp.java',
    concept: 'Scanner CLI & Menu Loop',
    summary: 'Terminal menu driver using java.util.Scanner with safe BigDecimal parsing and persistent file updates.',
    code: `package com.alderbank.cli;

import com.alderbank.model.Account;
import com.alderbank.model.Transaction;
import com.alderbank.service.BankService;
import com.alderbank.storage.FileStorage;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.Scanner;

public class ConsoleBankingApp {
    public static void main(String[] args) throws Exception {
        BankService service = new BankService(new FileStorage(Path.of("data", "alder_ledger.txt")));
        try (Scanner scanner = new Scanner(System.in)) {
            System.out.println("=== Alder Bank Console ===");
            Account current = null;

            while (current == null) {
                System.out.print("1) Sign In  2) Open Account  3) Exit > ");
                String choice = scanner.nextLine().trim();
                if ("3".equals(choice)) return;

                if ("2".equals(choice)) {
                    System.out.print("Full Name: ");
                    String name = scanner.nextLine();
                    System.out.print("PIN (4+ chars): ");
                    String pin = scanner.nextLine();
                    System.out.print("Initial Deposit (e.g. 100.00): ");
                    BigDecimal deposit = new BigDecimal(scanner.nextLine().trim());
                    current = service.register(name, "Checking", pin, deposit);
                    System.out.println("Created account: " + current.getAccountNumber());
                } else if ("1".equals(choice)) {
                    System.out.print("Account Number: ");
                    String accNo = scanner.nextLine();
                    System.out.print("PIN: ");
                    String pin = scanner.nextLine();
                    current = service.authenticate(accNo, pin).orElse(null);
                    if (current == null) System.out.println("Invalid credentials.");
                }
            }

            boolean running = true;
            while (running) {
                System.out.printf("%n[%s] 1) Balance  2) Deposit  3) Withdraw  4) History  5) Exit > ",
                    current.getAccountNumber());
                String cmd = scanner.nextLine().trim();
                try {
                    switch (cmd) {
                        case "1" -> System.out.printf("Current Balance: $%s%n", current.getBalance().toPlainString());
                        case "2" -> {
                            System.out.print("Deposit Amount: ");
                            BigDecimal amt = new BigDecimal(scanner.nextLine().trim());
                            System.out.print("Memo: ");
                            Transaction tx = service.deposit(current, amt, scanner.nextLine());
                            System.out.println("Recorded " + tx.id() + " | Balance: $" + tx.balanceAfter());
                        }
                        case "3" -> {
                            System.out.print("Withdrawal Amount: ");
                            BigDecimal amt = new BigDecimal(scanner.nextLine().trim());
                            System.out.print("Memo: ");
                            Transaction tx = service.withdraw(current, amt, scanner.nextLine());
                            System.out.println("Recorded " + tx.id() + " | Balance: $" + tx.balanceAfter());
                        }
                        case "4" -> {
                            for (Transaction tx : service.getHistory(current)) {
                                System.out.printf("%s | %-12s | $%10s | %s%n",
                                    tx.id(), tx.type(), tx.amount(), tx.description());
                            }
                        }
                        case "5" -> running = false;
                        default -> System.out.println("Unknown option. Enter 1-5.");
                    }
                } catch (Exception ex) {
                    System.out.println("Validation error: " + ex.getMessage());
                }
            }
        }
    }
}
`,
  },
];
