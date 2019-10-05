List<One__c> ones = [SELECT Id, Description__c, OneReference__c, TwoReference__c FROM One__c];
List<Two__c> twos = [SELECT Id, Description__c, OneReference__c FROM Two__c];

System.assertEquals(2, ones.size());
One__c selfref, tworef;
for (One__c one : ones) {
    switch on one.Description__c {
        when 'selfref' {
            selfref = one;
        }
        when 'tworef' {
            tworef = one;
        }
        when else {
            throw new VisualforceException();
        }
    }
}
System.assertEquals(1, twos.size());
Two__c two = twos.get(0);

System.assertEquals(tworef.Id, selfref.OneReference__c);
System.assertEquals(null,      selfref.TwoReference__c);
System.assertEquals(null,      tworef.OneReference__c);
System.assertEquals(two.Id,    tworef.TwoReference__c);
System.assertEquals('oneref',  two.Description__c);
System.assertEquals(tworef.Id, two.OneReference__c);

System.debug('Data validated successfully');