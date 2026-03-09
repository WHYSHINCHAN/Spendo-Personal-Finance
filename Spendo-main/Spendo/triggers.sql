-- Create a separate file with just the trigger definitions
-- Save this as triggers.sql and run it manually after schema creation

-- First, drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_goal_amount_after_contribution;
DROP TRIGGER IF EXISTS create_bill_due_notification;

-- Trigger to update goal amount when contribution is made
DELIMITER //
CREATE TRIGGER update_goal_amount_after_contribution
AFTER INSERT ON goal_contributions
FOR EACH ROW
BEGIN
    -- Update the current amount in the goal
    UPDATE goals SET 
        current_amount = current_amount + NEW.amount,
        is_completed = IF(current_amount + NEW.amount >= target_amount, TRUE, FALSE)
    WHERE id = NEW.goal_id;
END//
DELIMITER ;

-- Trigger to create notification when bill is due soon
DELIMITER //
CREATE TRIGGER create_bill_due_notification
AFTER UPDATE ON bills
FOR EACH ROW
BEGIN
    DECLARE days_until_due INT;
    
    -- Calculate days until due
    SET days_until_due = DATEDIFF(NEW.due_date, CURDATE());
    
    -- If bill is due in the reminder days, create a notification
    IF days_until_due <= NEW.reminder_days AND days_until_due >= 0 AND NOT NEW.is_paid THEN
        INSERT INTO notifications (user_id, title, message, type, related_entity, related_id)
        VALUES (
            NEW.user_id,
            CONCAT('Bill Due Soon: ', NEW.name),
            CONCAT('Your ', NEW.name, ' bill of ₹', NEW.amount, ' is due in ', days_until_due, ' days.'),
            'ALERT',
            'bills',
            NEW.id
        );
    END IF;
END//
DELIMITER ;